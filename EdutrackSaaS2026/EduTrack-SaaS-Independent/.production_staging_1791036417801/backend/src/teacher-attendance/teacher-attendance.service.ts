import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { TeacherAttendanceStatus } from '@prisma/client';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';
import { isWithinGeofence } from './utils/geofence.util';
import {
  generateSecureQrCode,
  extractQrToken,
  signQrPayload,
} from './utils/qr-crypto.util';

@Injectable()
export class TeacherAttendanceService {
  private readonly logger = new Logger(TeacherAttendanceService.name);

  // In-memory rate-limiter: Map<key, timestamp[]>
  private rateLimitMap = new Map<string, number[]>();

  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  /**
   * Simple sliding-window rate-limiter to protect scan and QR endpoints
   * Max 15 attempts per minute per key
   */
  private checkRateLimit(key: string, limit = 15, windowMs = 60000): boolean {
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(key) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      return false;
    }
    recent.push(now);
    this.rateLimitMap.set(key, recent);
    return true;
  }

  /**
   * Convert time string (e.g. "09:00 AM" or "09:15" or "14:30") to minutes from midnight
   */
  private parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 9 * 60; // 09:00 AM default
    try {
      const clean = timeStr.trim().toUpperCase();
      const isPm = clean.includes('PM');
      const isAm = clean.includes('AM');
      const parts = clean.replace(/AM|PM/g, '').trim().split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1] || '0', 10);

      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;

      return hours * 60 + minutes;
    } catch {
      return 9 * 60;
    }
  }

  /**
   * Helper to write audit log safely without throwing
   */
  private async writeAuditLog(data: {
    tenantId: string;
    userId?: string;
    teacherId?: string;
    qrCodeId?: string;
    action: string;
    result: string;
    reason?: string;
    scanSource?: string;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.teacherAttendanceAuditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId || null,
          teacherId: data.teacherId || null,
          qrCodeId: data.qrCodeId || null,
          action: data.action,
          result: data.result,
          reason: data.reason || null,
          scanSource: data.scanSource || 'IN_APP_SCANNER',
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          distanceMeters: data.distanceMeters ?? null,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create audit log: ${err?.message}`);
    }
  }

  // ==========================================
  // ADMIN: QR CODE MANAGEMENT
  // ==========================================

  /**
   * Get current active QR code and school settings for the tenant
   */
  async getActiveQr(tenantId?: string) {
    const activeTenantId = tenantId || this.getTenantId();

    const [activeQr, settings, tenant] = await Promise.all([
      this.prisma.teacherAttendanceQrCode.findFirst({
        where: {
          tenantId: activeTenantId,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.getSettings(activeTenantId),
      this.prisma.tenant.findUnique({
        where: { id: activeTenantId },
        select: { id: true, name: true, logoUrl: true, subDomain: true },
      }),
    ]);

    return {
      qrCode: activeQr,
      settings,
      tenant,
    };
  }

  /**
   * Generate initial or return existing active QR code
   */
  async generateQr(userId: string, tenantId?: string, dto?: GenerateQrDto) {
    const activeTenantId = tenantId || this.getTenantId();

    const existing = await this.prisma.teacherAttendanceQrCode.findFirst({
      where: {
        tenantId: activeTenantId,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      return this.getActiveQr(activeTenantId);
    }

    return this.createQrCodeRecord(userId, activeTenantId, 1, dto);
  }

  /**
   * Regenerate QR code: deactivates older active QRs and creates a new one
   */
  async regenerateQr(userId: string, tenantId?: string, dto?: GenerateQrDto) {
    const activeTenantId = tenantId || this.getTenantId();

    // 1. Mark existing active QRs as REVOKED
    const latestQr = await this.prisma.teacherAttendanceQrCode.findFirst({
      where: { tenantId: activeTenantId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestQr?.version || 0) + 1;

    await this.prisma.teacherAttendanceQrCode.updateMany({
      where: {
        tenantId: activeTenantId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
      },
    });

    const created = await this.createQrCodeRecord(
      userId,
      activeTenantId,
      nextVersion,
      dto,
      'QR_REGENERATED',
    );

    return created;
  }

  /**
   * Deactivate current active QR code
   */
  async deactivateQr(userId: string, tenantId?: string) {
    const activeTenantId = tenantId || this.getTenantId();

    const result = await this.prisma.teacherAttendanceQrCode.updateMany({
      where: {
        tenantId: activeTenantId,
        status: 'ACTIVE',
      },
      data: {
        status: 'INACTIVE',
      },
    });

    await this.writeAuditLog({
      tenantId: activeTenantId,
      userId,
      action: 'QR_DEACTIVATED',
      result: 'SUCCESS',
      reason: 'Admin manually deactivated active QR code',
    });

    return {
      success: true,
      message: 'Teacher Attendance QR code deactivated successfully.',
      deactivatedCount: result.count,
    };
  }

  private async createQrCodeRecord(
    userId: string,
    tenantId: string,
    version: number,
    dto?: GenerateQrDto,
    auditAction = 'QR_GENERATED',
  ) {
    const code = generateSecureQrCode();
    const qrId = crypto.randomUUID ? crypto.randomUUID() : 'qr_' + Date.now();

    // Payload conceptual structure & deep link URL
    const baseUrl =
      process.env.FRONTEND_PUBLIC_URL ||
      process.env.APP_URL ||
      'https://edutrackapplication.covenantsynergy.in';

    const deepLinkUrl = `${baseUrl.replace(/\/$/, '')}/teacher-attendance?token=${encodeURIComponent(code)}`;

    const qrRecord = await this.prisma.teacherAttendanceQrCode.create({
      data: {
        id: qrId,
        tenantId,
        code,
        qrPayload: deepLinkUrl,
        status: 'ACTIVE',
        version,
        createdById: userId,
        latitude: dto?.latitude ?? null,
        longitude: dto?.longitude ?? null,
        radiusMeters: dto?.radiusMeters ?? 150,
        requiresLocation: dto?.requiresLocation ?? false,
      },
    });

    await this.writeAuditLog({
      tenantId,
      userId,
      qrCodeId: qrRecord.id,
      action: auditAction,
      result: 'SUCCESS',
      reason: `Active QR code generated (Version ${version})`,
    });

    return this.getActiveQr(tenantId);
  }

  // ==========================================
  // SETTINGS MANAGEMENT
  // ==========================================

  async getSettings(tenantId?: string) {
    const activeTenantId = tenantId || this.getTenantId();

    let settings = await this.prisma.teacherAttendanceSetting.findUnique({
      where: { tenantId: activeTenantId },
    });

    if (!settings) {
      settings = await this.prisma.teacherAttendanceSetting.create({
        data: {
          tenantId: activeTenantId,
          workStartTime: '09:00 AM',
          lateThresholdMinutes: 15,
          halfDayThresholdTime: '12:00 PM',
          attendanceCutoffTime: '02:00 PM',
          allowedRadiusMeters: 200,
          enableGeofencing: false,
        },
      });
    }

    return settings;
  }

  async updateSettings(tenantId: string, dto: UpdateSettingsDto) {
    const activeTenantId = tenantId || this.getTenantId();

    const updated = await this.prisma.teacherAttendanceSetting.upsert({
      where: { tenantId: activeTenantId },
      update: {
        workStartTime: dto.workStartTime,
        lateThresholdMinutes: dto.lateThresholdMinutes,
        halfDayThresholdTime: dto.halfDayThresholdTime,
        attendanceCutoffTime: dto.attendanceCutoffTime,
        schoolLatitude: dto.schoolLatitude,
        schoolLongitude: dto.schoolLongitude,
        allowedRadiusMeters: dto.allowedRadiusMeters,
        enableGeofencing: dto.enableGeofencing,
      },
      create: {
        tenantId: activeTenantId,
        workStartTime: dto.workStartTime || '09:00 AM',
        lateThresholdMinutes: dto.lateThresholdMinutes ?? 15,
        halfDayThresholdTime: dto.halfDayThresholdTime || '12:00 PM',
        attendanceCutoffTime: dto.attendanceCutoffTime || '02:00 PM',
        schoolLatitude: dto.schoolLatitude,
        schoolLongitude: dto.schoolLongitude,
        allowedRadiusMeters: dto.allowedRadiusMeters ?? 200,
        enableGeofencing: dto.enableGeofencing ?? false,
      },
    });

    return updated;
  }

  // ==========================================
  // TEACHER: SCAN & RECORD ATTENDANCE
  // ==========================================

  /**
   * Main secure scan validation & attendance recording workflow
   */
  async scanAndRecordAttendance(
    user: { id: string; sub?: string; tenantId: string; role: string; name?: string },
    dto: ScanAttendanceDto,
    clientIp?: string,
    userAgent?: string,
  ) {
    const userId = user.id || user.sub;
    const userTenantId = user.tenantId;

    if (!userId || !userTenantId) {
      throw new ForbiddenException('Invalid user session');
    }

    // 1. Rate limiting check (max 10 scan attempts per 30s per user)
    const rateLimitKey = `scan_${userId}`;
    if (!this.checkRateLimit(rateLimitKey, 10, 30000)) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        action: 'SCAN_REJECTED',
        result: 'RATE_LIMITED',
        reason: 'Too many attendance scan attempts. Please wait a minute.',
        ipAddress: clientIp,
        userAgent,
      });
      throw new BadRequestException('Too many attendance scan attempts. Please wait a moment.');
    }

    // 2. Validate teacher identity & StaffProfile
    const staffProfile = await this.prisma.staffProfile.findFirst({
      where: {
        userId,
        tenantId: userTenantId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
    });

    if (!staffProfile || !staffProfile.user?.isActive) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        action: 'SCAN_REJECTED',
        result: 'UNAUTHORIZED_TEACHER',
        reason: 'User does not have an active teacher/staff profile in this school.',
        ipAddress: clientIp,
        userAgent,
      });
      throw new ForbiddenException('Only registered and active teachers can mark attendance.');
    }

    // 3. Extract & Validate QR Token
    const rawToken = extractQrToken(dto.token);
    if (!rawToken) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        action: 'SCAN_REJECTED',
        result: 'QR_INVALID',
        reason: 'Malformed or empty QR code token.',
        ipAddress: clientIp,
        userAgent,
      });
      throw new BadRequestException('This QR code is not a valid CS EduTrack teacher attendance QR.');
    }

    // 4. Find QR Code Record in database
    const qrRecord = await this.prisma.teacherAttendanceQrCode.findUnique({
      where: { code: rawToken },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!qrRecord) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        action: 'SCAN_REJECTED',
        result: 'QR_INVALID',
        reason: 'QR code not found in database.',
        ipAddress: clientIp,
        userAgent,
      });
      throw new BadRequestException('This QR code is not a valid CS EduTrack teacher attendance QR.');
    }

    // 5. Tenant Boundary Check (CRITICAL MULTI-TENANT ISOLATION)
    if (qrRecord.tenantId !== userTenantId) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        qrCodeId: qrRecord.id,
        action: 'SCAN_REJECTED',
        result: 'TENANT_MISMATCH',
        reason: `Tenant mismatch: Teacher from Tenant ${userTenantId} scanned QR for Tenant ${qrRecord.tenantId}`,
        ipAddress: clientIp,
        userAgent,
      });
      throw new ForbiddenException('This QR code belongs to a different school.');
    }

    // 6. QR Status Check
    if (qrRecord.status !== 'ACTIVE') {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        qrCodeId: qrRecord.id,
        action: 'SCAN_REJECTED',
        result: 'QR_INACTIVE',
        reason: `QR code status is ${qrRecord.status}`,
        ipAddress: clientIp,
        userAgent,
      });
      throw new BadRequestException('This attendance QR code is no longer active.');
    }

    // 7. Geolocation / Geofencing Verification
    const settings = await this.getSettings(userTenantId);
    let calculatedDistance: number | null = null;

    const geofenceRequired = settings.enableGeofencing || qrRecord.requiresLocation;
    const centerLat = qrRecord.latitude ?? settings.schoolLatitude;
    const centerLng = qrRecord.longitude ?? settings.schoolLongitude;
    const allowedRadius = qrRecord.radiusMeters ?? settings.allowedRadiusMeters ?? 200;

    if (geofenceRequired && centerLat != null && centerLng != null) {
      if (dto.latitude == null || dto.longitude == null) {
        await this.writeAuditLog({
          tenantId: userTenantId,
          userId,
          teacherId: staffProfile.id,
          qrCodeId: qrRecord.id,
          action: 'SCAN_REJECTED',
          result: 'OUTSIDE_GEOFENCE',
          reason: 'Geofencing enabled but coordinates were not provided by mobile device.',
          ipAddress: clientIp,
          userAgent,
        });
        throw new BadRequestException(
          'Location permission is required to verify attendance at the school.',
        );
      }

      const geoCheck = isWithinGeofence(
        dto.latitude,
        dto.longitude,
        centerLat,
        centerLng,
        allowedRadius,
      );

      calculatedDistance = geoCheck.distanceMeters;

      if (!geoCheck.within) {
        await this.writeAuditLog({
          tenantId: userTenantId,
          userId,
          teacherId: staffProfile.id,
          qrCodeId: qrRecord.id,
          action: 'SCAN_REJECTED',
          result: 'OUTSIDE_GEOFENCE',
          reason: `User is ${geoCheck.distanceMeters}m away from school (max radius: ${allowedRadius}m)`,
          latitude: dto.latitude,
          longitude: dto.longitude,
          distanceMeters: geoCheck.distanceMeters,
          ipAddress: clientIp,
          userAgent,
        });
        throw new BadRequestException(
          'Attendance cannot be marked because you are outside the school location.',
        );
      }
    }

    // 8. Determine Server-Side Attendance Date & Check for Duplicate
    const now = new Date();
    // Normalize to YYYY-MM-DD UTC midnight date
    const dateStr = now.toISOString().split('T')[0];
    const attendanceDate = new Date(`${dateStr}T00:00:00.000Z`);

    const existingAttendance = await this.prisma.teacherAttendance.findUnique({
      where: {
        tenantId_teacherId_attendanceDate: {
          tenantId: userTenantId,
          teacherId: staffProfile.id,
          attendanceDate,
        },
      },
    });

    if (existingAttendance) {
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        qrCodeId: qrRecord.id,
        action: 'SCAN_REJECTED',
        result: 'ALREADY_MARKED',
        reason: 'Attendance already recorded for today.',
        latitude: dto.latitude,
        longitude: dto.longitude,
        distanceMeters: calculatedDistance ?? undefined,
        ipAddress: clientIp,
        userAgent,
      });

      return {
        success: true,
        alreadyMarked: true,
        message: 'Your attendance has already been marked for today.',
        attendance: {
          id: existingAttendance.id,
          date: dateStr,
          checkInTime: existingAttendance.checkInTime,
          status: existingAttendance.status,
          teacherName: staffProfile.user.name,
          schoolName: qrRecord.tenant.name,
        },
      };
    }

    // 9. Calculate Status (PRESENT vs LATE)
    // Server local time check
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const workStartMinutes = this.parseTimeToMinutes(settings.workStartTime);
    const lateThresholdMinutes = settings.lateThresholdMinutes ?? 15;
    const lateCutoffMinutes = workStartMinutes + lateThresholdMinutes;

    let status: TeacherAttendanceStatus = TeacherAttendanceStatus.PRESENT;
    if (currentMinutes > lateCutoffMinutes) {
      status = TeacherAttendanceStatus.LATE;
    }

    // 10. Record Attendance in Database
    try {
      const attendanceRecord = await this.prisma.teacherAttendance.create({
        data: {
          tenantId: userTenantId,
          teacherId: staffProfile.id,
          userId,
          attendanceDate,
          checkInTime: now,
          status,
          qrCodeId: qrRecord.id,
          scanSource: dto.scanSource || 'IN_APP_SCANNER',
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          distanceMeters: calculatedDistance,
          ipAddress: clientIp ?? null,
          userAgent: userAgent ?? null,
        },
      });

      // 11. Write Success Audit Log
      await this.writeAuditLog({
        tenantId: userTenantId,
        userId,
        teacherId: staffProfile.id,
        qrCodeId: qrRecord.id,
        action: 'SCAN_SUCCESS',
        result: 'SUCCESS',
        reason: `Attendance recorded as ${status}`,
        scanSource: dto.scanSource || 'IN_APP_SCANNER',
        latitude: dto.latitude,
        longitude: dto.longitude,
        distanceMeters: calculatedDistance ?? undefined,
        ipAddress: clientIp,
        userAgent,
      });

      return {
        success: true,
        alreadyMarked: false,
        message:
          status === TeacherAttendanceStatus.LATE
            ? 'Attendance recorded (Marked as Late).'
            : 'Attendance marked successfully!',
        attendance: {
          id: attendanceRecord.id,
          date: dateStr,
          checkInTime: attendanceRecord.checkInTime,
          status: attendanceRecord.status,
          teacherName: staffProfile.user.name,
          employeeId: staffProfile.employeeId || 'N/A',
          designation: staffProfile.designation || 'Teacher',
          schoolName: qrRecord.tenant.name,
        },
      };
    } catch (err: any) {
      // Catch possible race condition duplicate DB error
      if (err.code === 'P2002') {
        return {
          success: true,
          alreadyMarked: true,
          message: 'Your attendance has already been marked for today.',
          attendance: {
            date: dateStr,
            status: TeacherAttendanceStatus.PRESENT,
            teacherName: staffProfile.user.name,
            schoolName: qrRecord.tenant.name,
          },
        };
      }
      this.logger.error(`Attendance save error: ${err.message}`, err.stack);
      throw new BadRequestException('Unable to record attendance. Please try again.');
    }
  }

  // ==========================================
  // TEACHER: MY ATTENDANCE STATUS & HISTORY
  // ==========================================

  /**
   * Get teacher's today attendance status
   */
  async getMyTodayStatus(userId: string, tenantId?: string) {
    const activeTenantId = tenantId || this.getTenantId();

    const staffProfile = await this.prisma.staffProfile.findFirst({
      where: { userId, tenantId: activeTenantId },
    });

    if (!staffProfile) {
      return { marked: false, attendance: null };
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(`${dateStr}T00:00:00.000Z`);

    const attendance = await this.prisma.teacherAttendance.findUnique({
      where: {
        tenantId_teacherId_attendanceDate: {
          tenantId: activeTenantId,
          teacherId: staffProfile.id,
          attendanceDate,
        },
      },
    });

    return {
      marked: !!attendance,
      attendance,
      todayDate: dateStr,
    };
  }

  /**
   * Get teacher's attendance history and monthly summary statistics
   */
  async getMyAttendanceHistory(userId: string, tenantId?: string, month?: string) {
    const activeTenantId = tenantId || this.getTenantId();

    const staffProfile = await this.prisma.staffProfile.findFirst({
      where: { userId, tenantId: activeTenantId },
      include: { user: { select: { name: true } } },
    });

    if (!staffProfile) {
      throw new NotFoundException('Teacher profile not found.');
    }

    // Determine date range
    const targetMonth = month || new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    const records = await this.prisma.teacherAttendance.findMany({
      where: {
        tenantId: activeTenantId,
        teacherId: staffProfile.id,
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { attendanceDate: 'desc' },
    });

    // Calculate monthly summary
    const presentDays = records.filter((r) => r.status === 'PRESENT').length;
    const lateDays = records.filter((r) => r.status === 'LATE').length;
    const halfDays = records.filter((r) => r.status === 'HALF_DAY').length;

    // Check approved leave requests for this month
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId: activeTenantId,
        teacherId: staffProfile.id,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    const totalMarkedDays = records.length;
    const attendancePercentage =
      totalMarkedDays > 0 ? Math.round(((presentDays + lateDays) / totalMarkedDays) * 100) : 100;

    return {
      month: targetMonth,
      teacher: {
        name: staffProfile.user.name,
        employeeId: staffProfile.employeeId,
        designation: staffProfile.designation,
      },
      summary: {
        totalDaysMarked: totalMarkedDays,
        presentDays,
        lateDays,
        halfDays,
        leaveDays: leaves.length,
        attendancePercentage,
      },
      records: records.map((r) => ({
        id: r.id,
        date: r.attendanceDate.toISOString().split('T')[0],
        checkInTime: r.checkInTime,
        status: r.status,
        scanSource: r.scanSource,
      })),
    };
  }

  // ==========================================
  // ADMIN: DASHBOARD & REPORTING
  // ==========================================

  /**
   * Admin: Get today's attendance summary and teacher list
   */
  async getAdminTodayAttendance(
    tenantId: string,
    filters?: { status?: string; department?: string; search?: string; date?: string },
  ) {
    const activeTenantId = tenantId || this.getTenantId();

    const selectedDateStr = filters?.date || new Date().toISOString().split('T')[0];
    const attendanceDate = new Date(`${selectedDateStr}T00:00:00.000Z`);

    // Fetch all active teachers/staff in tenant
    const teachers = await this.prisma.staffProfile.findMany({
      where: {
        tenantId: activeTenantId,
        user: { isActive: true },
        staffCategory: { not: 'STUDENT' },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    // Fetch all attendance records for the selected date
    const attendances = await this.prisma.teacherAttendance.findMany({
      where: {
        tenantId: activeTenantId,
        attendanceDate,
      },
    });

    const attendanceMap = new Map(attendances.map((a) => [a.teacherId, a]));

    // Merge teachers with attendance
    let list = teachers.map((t) => {
      const att = attendanceMap.get(t.id);
      return {
        id: t.id,
        userId: t.userId,
        name: t.user.name,
        email: t.user.email,
        phone: t.user.phone,
        avatarUrl: t.user.avatarUrl,
        employeeId: t.employeeId || 'N/A',
        designation: t.designation || 'Teacher',
        department: t.staffRole || t.staffCategory || 'Teaching',
        status: att ? att.status : 'ABSENT',
        checkInTime: att ? att.checkInTime : null,
        scanSource: att ? att.scanSource : null,
        attendanceId: att ? att.id : null,
        distanceMeters: att ? att.distanceMeters : null,
      };
    });

    // Apply filters
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((item) => item.status === filters.status);
    }

    if (filters?.department && filters.department !== 'ALL') {
      list = list.filter((item) =>
        item.department.toLowerCase().includes(filters.department!.toLowerCase()),
      );
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.employeeId.toLowerCase().includes(q) ||
          item.designation.toLowerCase().includes(q),
      );
    }

    // Calculate KPIs
    const totalTeachers = teachers.length;
    const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
    const lateCount = attendances.filter((a) => a.status === 'LATE').length;
    const absentCount = totalTeachers - (presentCount + lateCount);
    const attendanceRate =
      totalTeachers > 0 ? Math.round(((presentCount + lateCount) / totalTeachers) * 100) : 0;

    return {
      date: selectedDateStr,
      kpis: {
        totalTeachers,
        presentCount,
        lateCount,
        absentCount: Math.max(0, absentCount),
        attendanceRate,
      },
      teachers: list,
    };
  }

  /**
   * Admin: Get audit logs
   */
  async getAuditLogs(tenantId: string, limit = 50) {
    const activeTenantId = tenantId || this.getTenantId();

    return this.prisma.teacherAttendanceAuditLog.findMany({
      where: { tenantId: activeTenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
