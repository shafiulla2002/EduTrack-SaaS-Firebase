import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { AttendanceStatus, Role } from '@prisma/client';
import { RoleFilterHelper } from '../common/role-filter.helper';
import { 
  getTodayDateString, 
  formatAttendanceDate, 
  parseAttendanceDate, 
  isBeforeDateString 
} from './date.utils';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private roleFilterHelper: RoleFilterHelper,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
  }

  // Salesforce parity: get classes associated with tenant
  // Teacher role → only assigned classes via RoleFilterHelper
  async getClasses(userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (scope.assignedClassSectionIds.length === 0) return [];
      // Resolve class names from assigned class-sections
      const classSections = await this.prisma.classSection.findMany({
        where: { id: { in: scope.assignedClassSectionIds }, tenantId },
        include: { class: true },
      });
      const classesMap = new Map();
      classSections.forEach(cs => classesMap.set(cs.class.id, cs.class));
      return Array.from(classesMap.values()).map((c: any) => ({
        label: c.name,
        value: c.name,
      }));
    }

    // Admin: all classes
    const classes = await this.prisma.class.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return classes.map(c => ({
      label: c.name,
      value: c.name,
    }));
  }

  // Salesforce parity: get sections associated with tenant
  // Teacher role → only assigned sections, optionally filtered by class name
  async getSections(classVal?: string, userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (scope.assignedClassSectionIds.length === 0) return [];
      const classSections = await this.prisma.classSection.findMany({
        where: {
          id: { in: scope.assignedClassSectionIds },
          tenantId,
          ...(classVal ? { class: { name: { equals: classVal, mode: 'insensitive' } } } : {}),
        },
        include: { section: true },
      });
      const sectionsMap = new Map();
      classSections.forEach(cs => sectionsMap.set(cs.section.id, cs.section));
      return Array.from(sectionsMap.values()).map((s: any) => ({
        label: s.name,
        value: s.name,
      }));
    }

    // Admin: all sections
    const sections = await this.prisma.section.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return sections.map(s => ({
      label: s.name,
      value: s.name,
    }));
  }

  // Salesforce parity: get teachers associated with tenant
  async getTeachers() {
    const tenantId = this.getTenantId();
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        user: {
          role: { in: [Role.TEACHER, Role.STAFF] },
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
      take: 1000,
    });

    return staff.map(s => ({
      id: s.id,
      name: s.user.name,
      subject: s.subjectsTaught[0] || 'N/A',
    }));
  }

  // Salesforce parity: get today's recent submissions
  async getRecentSubmissions() {
    const tenantId = this.getTenantId();
    const todayStr = getTodayDateString();
    const todayDate = parseAttendanceDate(todayStr);

    const todaySessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        date: todayDate,
      },
      include: {
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
        takenBy: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (todaySessions.length === 0) {
      return [
        {
          id: 'pending',
          text: "Today's attendance is currently pending",
        },
      ];
    }

    return todaySessions.map(s => {
      const className = s.classSection?.class?.name || 'N/A';
      const sectionName = s.classSection?.section?.name || 'N/A';
      const teacherName = s.takenBy?.user?.name || 'N/A';
      return {
        id: s.id,
        text: `${className} - ${sectionName} submitted by ${teacherName}`,
      };
    });
  }

  // Salesforce parity: get all historical sessions
  async getHistory() {
    const tenantId = this.getTenantId();
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId },
      include: {
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
        takenBy: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return sessions.map(s => {
      return {
        id: s.id,
        date: formatAttendanceDate(s.date),
        classSection: {
          class: { name: s.classSection?.class?.name || 'N/A' },
          section: { name: s.classSection?.section?.name || 'N/A' },
        },
        presentCount: s.presentCount,
        absentCount: s.absentCount,
        totalStudents: s.totalStudents,
        teacherId: s.takenById,
        teacherName: s.takenBy?.user?.name || 'N/A',
      };
    });
  }


  // Salesforce parity: resolve names and get students
  async getStudents(classVal: string, sectionVal: string, userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    if (!classVal || !sectionVal) return [];

    const cls = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: { equals: classVal.trim(), mode: 'insensitive' },
      },
    });

    const sec = await this.prisma.section.findFirst({
      where: {
        tenantId,
        name: { equals: sectionVal.trim(), mode: 'insensitive' },
      },
    });

    if (!cls || !sec) return [];

    const classSection = await this.prisma.classSection.findUnique({
      where: {
        classId_sectionId: {
          classId: cls.id,
          sectionId: sec.id,
        },
      },
    });

    if (!classSection) return [];

    // Verify teacher assignment for safety (getStudents)
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (!scope.assignedClassSectionIds.includes(classSection.id)) {
        throw new BadRequestException('You do not have teaching permissions for this class.');
      }
    }

    const studentList = await this.prisma.studentProfile.findMany({
      where: {
        tenantId,
        classSectionId: classSection.id,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: {
        user: { name: 'asc' },
      },
      take: 1000,
    });

    return studentList.map(s => ({
      Id: s.id,
      Name: s.user.name,
      Roll_No__c: s.rollNo || '',
    }));
  }

  // Salesforce parity: resolve names and get session data
  async getSessionData(classVal: string, sectionVal: string, dateStr: string, userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    if (!classVal || !sectionVal || !dateStr) {
      return { sessionExists: false, absentIds: [], total: 0, present: 0, absent: 0 };
    }

    const cls = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: { equals: classVal.trim(), mode: 'insensitive' },
      },
    });

    const sec = await this.prisma.section.findFirst({
      where: {
        tenantId,
        name: { equals: sectionVal.trim(), mode: 'insensitive' },
      },
    });

    if (!cls || !sec) {
      return { sessionExists: false, absentIds: [], total: 0, present: 0, absent: 0 };
    }

    const classSection = await this.prisma.classSection.findUnique({
      where: {
        classId_sectionId: {
          classId: cls.id,
          sectionId: sec.id,
        },
      },
    });

    if (!classSection) {
      return { sessionExists: false, absentIds: [], total: 0, present: 0, absent: 0 };
    }

    // Verify teacher assignment for safety (getSessionData)
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (!scope.assignedClassSectionIds.includes(classSection.id)) {
        throw new BadRequestException('You do not have teaching permissions for this class.');
      }
    }

    const searchDate = parseAttendanceDate(dateStr);

    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        tenantId,
        classSectionId: classSection.id,
        date: searchDate,
      },
      include: {
        attendances: true,
        takenBy: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return { sessionExists: false, absentIds: [], total: 0, present: 0, absent: 0 };
    }

    const absentIds = session.attendances
      .filter(a => a.status === AttendanceStatus.ABSENT)
      .map(a => a.studentId);

    return {
      sessionExists: true,
      sessionId: session.id,
      teacherName: session.takenBy?.user?.name || 'Unknown',
      createdTime: this.formatTime(session.createdAt),
      lastUpdatedTime: this.formatTime(session.updatedAt),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      total: session.totalStudents,
      present: session.presentCount,
      absent: session.absentCount,
      absentIds,
    };
  }

  // Salesforce parity: save attendance with name resolution, auto-creation, duplication removal, past-date read-only validation
  async saveAttendance(data: any, userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    const date = parseAttendanceDate(data.dateStr || data.date);
    const dateStr = data.dateStr || formatAttendanceDate(date);

    // Validate historical date lock using timezone-safe string comparison
    const todayStr = getTodayDateString();
    if (isBeforeDateString(dateStr, todayStr) && !data.allowPastDates) {
      throw new BadRequestException('Historical records are in Read-Only mode.');
    }

    const classVal = (data.classVal || '').trim();
    const sectionVal = (data.sectionVal || '').trim();
    const absentStudentIds = data.absentStudentIds || [];
    const totalStudents = data.totalStudents || 0;
    const presentCount = data.presentCount || 0;
    const absentCount = data.absentCount || 0;
    let teacherId = data.teacherId;

    if (!classVal || !sectionVal) {
      throw new BadRequestException('Class and Section names are required.');
    }

    // Resolve classSection if teacher for assignment validation (saveAttendance)
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      const clsObj = await this.prisma.class.findFirst({
        where: { tenantId, name: { equals: classVal, mode: 'insensitive' } },
      });
      const secObj = await this.prisma.section.findFirst({
        where: { tenantId, name: { equals: sectionVal, mode: 'insensitive' } },
      });
      if (clsObj && secObj) {
        const cs = await this.prisma.classSection.findFirst({
          where: { classId: clsObj.id, sectionId: secObj.id },
        });
        if (cs && !scope.assignedClassSectionIds.includes(cs.id)) {
          throw new BadRequestException('You do not have teaching permissions for this class.');
        }
      }
      teacherId = scope.staff.id;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find or create Class record
      let cls = await tx.class.findFirst({
        where: {
          tenantId,
          name: { equals: classVal, mode: 'insensitive' },
        },
      });

      if (!cls) {
        // Find default active Academic Year
        const acadYear = await tx.academicYear.findFirst({
          where: { tenantId, isActive: true },
        });
        if (!acadYear) {
          throw new BadRequestException('No active Academic Year found for setup.');
        }
        cls = await tx.class.create({
          data: {
            name: classVal,
            tenantId,
            academicYearId: acadYear.id,
          },
        });
      }

      // 2. Find or create Section record
      let sec = await tx.section.findFirst({
        where: {
          tenantId,
          name: { equals: sectionVal, mode: 'insensitive' },
        },
      });

      if (!sec) {
        sec = await tx.section.create({
          data: {
            name: sectionVal,
            tenantId,
          },
        });
      }

      // 3. Find or create ClassSection record
      let classSection = await tx.classSection.findUnique({
        where: {
          classId_sectionId: {
            classId: cls.id,
            sectionId: sec.id,
          },
        },
      });

      if (!classSection) {
        classSection = await tx.classSection.create({
          data: {
            classId: cls.id,
            sectionId: sec.id,
            tenantId,
          },
        });
      }

      // Resolve a valid teacher (StaffProfile ID) to avoid foreign key constraint crashes
      let finalTeacherId = teacherId;
      if (!finalTeacherId) {
        const firstStaff = await tx.staffProfile.findFirst({
          where: { tenantId }
        });
        if (firstStaff) {
          finalTeacherId = firstStaff.id;
        } else {
          throw new BadRequestException('No teacher/staff profile exists for this school. Please register a teacher first.');
        }
      } else {
        const staffExists = await tx.staffProfile.findUnique({
          where: { id: finalTeacherId }
        });
        if (!staffExists) {
          const firstStaff = await tx.staffProfile.findFirst({
            where: { tenantId }
          });
          if (firstStaff) {
            finalTeacherId = firstStaff.id;
          } else {
            throw new BadRequestException('Teacher profile not found.');
          }
        }
      }

      // 4. Duplicate prevention: find duplicate sessions and delete all except first
      const existingSessions = await tx.attendanceSession.findMany({
        where: {
          tenantId,
          classSectionId: classSection.id,
          date,
        },
        orderBy: { createdAt: 'asc' },
      });

      let session;
      if (existingSessions.length === 0) {
        session = await tx.attendanceSession.create({
          data: {
            classSectionId: classSection.id,
            date,
            takenById: finalTeacherId,
            presentCount,
            absentCount,
            totalStudents,
            tenantId,
          },
        });
      } else {
        session = existingSessions[0];
        
        // Clean up duplicate sessions
        if (existingSessions.length > 1) {
          const duplicateIds = existingSessions.slice(1).map(s => s.id);
          await tx.attendanceSession.deleteMany({
            where: {
              id: { in: duplicateIds },
            },
          });
        }

        // Update active session stats
        session = await tx.attendanceSession.update({
          where: { id: session.id },
          data: {
            presentCount,
            absentCount,
            totalStudents,
            takenById: finalTeacherId,
          },
        });
      }

      // 5. Implicit present storage management:
      // Delete existing records that are NOT in the new absent list (they are now present)
      await tx.attendance.deleteMany({
        where: {
          attendanceSessionId: session.id,
          NOT: {
            studentId: { in: absentStudentIds },
          },
        },
      });

      // Fetch already stored absent records to avoid duplicates
      const storedAbsents = await tx.attendance.findMany({
        where: {
          attendanceSessionId: session.id,
          studentId: { in: absentStudentIds },
        },
        select: { studentId: true },
      });
      const storedAbsentIds = new Set(storedAbsents.map(a => a.studentId));

      // Insert new records for newly absent students
      const newAbsents = absentStudentIds.filter(id => !storedAbsentIds.has(id));
      if (newAbsents.length > 0) {
        const attendanceData = newAbsents.map(studentId => ({
          attendanceSessionId: session.id,
          studentId,
          status: AttendanceStatus.ABSENT,
          tenantId,
        }));
        await tx.attendance.createMany({
          data: attendanceData,
        });
      }

      return { classVal, sectionVal, dateStr: data.dateStr || data.date };
    }, { timeout: 25000 });

    // Run outside the database write lock transaction to avoid transaction deadlocks
    return this.getSessionData(result.classVal, result.sectionVal, result.dateStr);
  }

  // Salesforce parity: get bundled attendance data for reports
  async getAttendanceData(startDateStr: string, endDateStr: string) {
    const tenantId = this.getTenantId();
    const startDate = parseAttendanceDate(startDateStr);
    const endDate = parseAttendanceDate(endDateStr);

    // 1. Fetch Students
    const rawStudents = await this.prisma.studentProfile.findMany({
      where: { tenantId },
      include: {
        user: { select: { name: true } },
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
      },
    });

    const students = rawStudents.map(s => ({
      id: s.id,
      name: s.user.name,
      rollNo: s.rollNo || '',
      section: s.classSection?.section?.name || '',
      classValue: s.classSection?.class?.name || '',
      className: s.classSection?.class?.name || '',
    }));

    // 2. Fetch Attendance Records (Absent Only)
    const rawAttendance = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        attendanceSession: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        student: {
          select: {
            rollNo: true,
            user: { select: { name: true } },
            classSection: {
              include: {
                class: true,
                section: true,
              },
            },
          },
        },
        attendanceSession: {
          include: {
            classSection: {
              include: {
                class: true,
                section: true,
              },
            },
          },
        },
      },
    });

    const attendanceRecords = rawAttendance.map(a => {
      const studentName = a.student?.user?.name || 'Unknown';
      const rollNo = a.student?.rollNo || '';
      const section = a.attendanceSession?.classSection?.section?.name || '';
      const classValue = a.attendanceSession?.classSection?.class?.name || '';
      return {
        id: a.id,
        studentId: a.studentId,
        studentName,
        rollNo,
        section,
        classValue,
        className: classValue,
        attendanceDate: formatAttendanceDate(a.attendanceSession.date),
        status: a.status === AttendanceStatus.ABSENT ? 'Absent' : 'Present',
      };
    });

    // 3. Fetch Classes
    const uniqueClasses = Array.from(new Set(students.map(s => s.classValue).filter(Boolean)));

    // 4. Fetch Sections
    const uniqueSections = Array.from(new Set(students.map(s => s.section).filter(Boolean)));

    // 5. Fetch Sessions
    const rawSessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
      },
    });

    const sessions = rawSessions.map(s => ({
      id: s.id,
      classId: s.classSection?.class?.id || '',
      className: s.classSection?.class?.name || '',
      classValue: s.classSection?.class?.name || '',
      attendanceDate: formatAttendanceDate(s.date),
      section: s.classSection?.section?.name || '',
      totalStudents: s.totalStudents,
      presentCount: s.presentCount,
      absentCount: s.absentCount,
    }));

    // 6. Debug stats
    const totalAcc = await this.prisma.studentProfile.count({ where: { tenantId } });
    const debugStats = `Total StudentProfiles: ${totalAcc} | Matches: ${students.length}`;

    return {
      students,
      attendanceRecords,
      classes: uniqueClasses,
      sections: uniqueSections,
      sessions,
      debugStats,
    };
  }

  // Fallback REST endpoint helpers (retaining generic routes from old controllers)
  async getAttendanceById(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.attendance.findUnique({
      where: { id, tenantId },
    });
  }

  async updateAttendance(id: string, updateDto: any) {
    const tenantId = this.getTenantId();
    return this.prisma.attendance.update({
      where: { id, tenantId },
      data: {
        status: updateDto.status,
        reason: updateDto.reason,
      },
    });
  }

  async deleteAttendance(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.attendance.delete({
      where: { id, tenantId },
    });
  }

  async getDailySummary(date?: string) {
    const tenantId = this.getTenantId();
    const searchDate = parseAttendanceDate(date);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId, date: searchDate },
    });

    return sessions.reduce(
      (acc, s) => {
        acc.totalStudents += s.totalStudents;
        acc.present += s.presentCount;
        acc.absent += s.absentCount;
        return acc;
      },
      { totalStudents: 0, present: 0, absent: 0 },
    );
  }

  async getMonthlySummary(month?: string, year?: string) {
    const tenantId = this.getTenantId();
    const now = new Date();
    const m = month ? parseInt(month, 10) - 1 : now.getMonth();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
    });

    return sessions.reduce(
      (acc, s) => {
        acc.totalStudents += s.totalStudents;
        acc.present += s.presentCount;
        acc.absent += s.absentCount;
        return acc;
      },
      { totalStudents: 0, present: 0, absent: 0 },
    );
  }

  async getClassAttendanceReport(classSectionId: string, date?: string) {
    const tenantId = this.getTenantId();
    const where: any = { tenantId, classSectionId };
    if (date) {
      where.date = parseAttendanceDate(date);
    }

    const sessions = await this.prisma.attendanceSession.findMany({ where });
    return sessions.reduce(
      (acc, s) => {
        acc.totalStudents += s.totalStudents;
        acc.present += s.presentCount;
        acc.absent += s.absentCount;
        return acc;
      },
      { totalStudents: 0, present: 0, absent: 0 },
    );
  }

  async getStudentAttendanceReport(studentId: string, date?: string) {
    const tenantId = this.getTenantId();
    const where: any = { tenantId, studentId };
    if (date) {
      where.attendanceSession = { date: parseAttendanceDate(date) };
    }

    const records = await this.prisma.attendance.findMany({ where });
    const total = records.length;
    const present = records.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const absent = records.filter(r => r.status === AttendanceStatus.ABSENT).length;
    return { total, present, absent };
  }
}
