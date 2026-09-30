import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { TeacherAttendanceService } from './teacher-attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ScanAttendanceDto } from './dto/scan-attendance.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { GenerateQrDto } from './dto/generate-qr.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teacher-attendance')
export class TeacherAttendanceController {
  constructor(private attendanceService: TeacherAttendanceService) {}

  // ==========================================
  // ADMIN: QR MANAGEMENT & SETTINGS
  // ==========================================

  @Get('qr')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getActiveQr(@Req() req: any) {
    return this.attendanceService.getActiveQr(req.user.tenantId);
  }

  @Post('qr/generate')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async generateQr(@Req() req: any, @Body() dto: GenerateQrDto) {
    return this.attendanceService.generateQr(req.user.id || req.user.sub, req.user.tenantId, dto);
  }

  @Post('qr/regenerate')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async regenerateQr(@Req() req: any, @Body() dto: GenerateQrDto) {
    return this.attendanceService.regenerateQr(req.user.id || req.user.sub, req.user.tenantId, dto);
  }

  @Post('qr/deactivate')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async deactivateQr(@Req() req: any) {
    return this.attendanceService.deactivateQr(req.user.id || req.user.sub, req.user.tenantId);
  }

  @Get('settings')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getSettings(@Req() req: any) {
    return this.attendanceService.getSettings(req.user.tenantId);
  }

  @Put('settings')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateSettings(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.attendanceService.updateSettings(req.user.tenantId, dto);
  }

  // ==========================================
  // TEACHER: SCAN & ATTENDANCE RECORDING
  // ==========================================

  @Post('scan')
  @Roles(Role.TEACHER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async scanAttendance(
    @Req() req: any,
    @Body() dto: ScanAttendanceDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.attendanceService.scanAndRecordAttendance(
      req.user,
      dto,
      ip,
      userAgent,
    );
  }

  @Get('my-today')
  @Roles(Role.TEACHER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getMyToday(@Req() req: any) {
    return this.attendanceService.getMyTodayStatus(
      req.user.id || req.user.sub,
      req.user.tenantId,
    );
  }

  @Get('my-history')
  @Roles(Role.TEACHER, Role.STAFF, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getMyHistory(@Req() req: any, @Query('month') month?: string) {
    return this.attendanceService.getMyAttendanceHistory(
      req.user.id || req.user.sub,
      req.user.tenantId,
      month,
    );
  }

  // ==========================================
  // ADMIN: ATTENDANCE DASHBOARD & AUDIT LOGS
  // ==========================================

  @Get('admin/today')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getAdminToday(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getAdminTodayAttendance(req.user.tenantId, {
      status,
      department,
      search,
      date,
    });
  }

  @Get('admin/audit-logs')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getAuditLogs(@Req() req: any, @Query('limit') limit?: number) {
    return this.attendanceService.getAuditLogs(req.user.tenantId, limit ? Number(limit) : 50);
  }
}
