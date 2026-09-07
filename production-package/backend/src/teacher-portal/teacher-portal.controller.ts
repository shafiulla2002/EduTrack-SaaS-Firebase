import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TeacherPortalService } from './teacher-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.SCHOOL_ADMIN)
@Controller('teacher-portal')
export class TeacherPortalController {
  constructor(private portalService: TeacherPortalService) {}

  @Get('dashboard')
  @Roles(Role.TEACHER)
  async getDashboard(@Req() req: any) {
    return this.portalService.getDashboardStats(req.user.sub, req.user.tenantId);
  }

  @Get('profile')
  @Roles(Role.TEACHER)
  async getProfile(@Req() req: any) {
    return this.portalService.getProfile(req.user.sub, req.user.tenantId);
  }

  @Put('profile')
  @Roles(Role.TEACHER)
  async updateProfile(@Req() req: any, @Body() data: any) {
    return this.portalService.updateProfile(req.user.sub, req.user.tenantId, data);
  }

  @Post('profile/change-password')
  @Roles(Role.TEACHER)
  async changePassword(@Req() req: any, @Body() data: any) {
    return this.portalService.changePassword(req.user.sub, req.user.tenantId, data);
  }

  @Get('classes')
  async getClasses(@Req() req: any) {
    return this.portalService.getAssignedClasses(req.user.sub, req.user.tenantId);
  }

  @Get('classes/:classSectionId/students')
  @Roles(Role.TEACHER)
  async getStudents(@Req() req: any, @Param('classSectionId') classSectionId: string) {
    return this.portalService.getStudentsForClassSection(req.user.sub, req.user.tenantId, classSectionId);
  }

  @Get('attendance/classes')
  @Roles(Role.TEACHER)
  async getAttendanceClasses(@Req() req: any) {
    return this.portalService.getClassesForAttendance(req.user.sub, req.user.tenantId);
  }

  @Get('attendance/sections')
  @Roles(Role.TEACHER)
  async getAttendanceSections(@Req() req: any, @Query('classVal') classVal: string) {
    return this.portalService.getSectionsForAttendance(req.user.sub, req.user.tenantId, classVal);
  }

  @Get('attendance/students')
  @Roles(Role.TEACHER)
  async getAttendanceStudents(
    @Req() req: any,
    @Query('classVal') classVal: string,
    @Query('sectionVal') sectionVal: string,
  ) {
    return this.portalService.getStudentsForAttendance(req.user.sub, req.user.tenantId, classVal, sectionVal);
  }

  @Post('attendance/save')
  @Roles(Role.TEACHER)
  async saveAttendance(@Req() req: any, @Body() data: any) {
    return this.portalService.saveAttendanceSheet(req.user.sub, req.user.tenantId, data);
  }

  @Get('attendance/history')
  @Roles(Role.TEACHER)
  async getAttendanceHistory(@Req() req: any) {
    return this.portalService.getAttendanceHistory(req.user.sub, req.user.tenantId);
  }

  @Get('marks/entry')
  @Roles(Role.TEACHER)
  async getMarksEntryList(
    @Req() req: any,
    @Query('subjectId') subjectId: string,
    @Query('examName') examName: string,
    @Query('classSectionId') classSectionId: string,
    @Query('subjectType') subjectType?: string,
  ) {
    return this.portalService.getExamMarksEntryList(req.user.sub, req.user.tenantId, subjectId, examName, classSectionId, subjectType);
  }

  @Post('marks/save')
  @Roles(Role.TEACHER)
  async saveMarks(@Req() req: any, @Body() data: any) {
    return this.portalService.saveExamMarksList(req.user.sub, req.user.tenantId, data);
  }

  @Get('timetable')
  @Roles(Role.TEACHER)
  async getTimetable(@Req() req: any) {
    return this.portalService.getTeacherWeeklySchedule(req.user.sub, req.user.tenantId);
  }

  @Get('homework')
  @Roles(Role.TEACHER)
  async getHomeworks(@Req() req: any) {
    return this.portalService.getHomeworks(req.user.sub, req.user.tenantId);
  }

  @Post('homework')
  @Roles(Role.TEACHER)
  async createHomework(@Req() req: any, @Body() data: any) {
    return this.portalService.createHomework(req.user.sub, req.user.tenantId, data);
  }

  @Put('homework/:id')
  @Roles(Role.TEACHER)
  async updateHomework(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.portalService.updateHomework(req.user.sub, req.user.tenantId, id, data);
  }

  @Delete('homework/:id')
  @Roles(Role.TEACHER)
  async deleteHomework(@Req() req: any, @Param('id') id: string) {
    return this.portalService.deleteHomework(req.user.sub, req.user.tenantId, id);
  }

  @Get('homework/:id/submissions')
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN)
  async getHomeworkSubmissions(@Req() req: any, @Param('id') id: string) {
    return this.portalService.getHomeworkSubmissions(req.user.sub, req.user.tenantId, id);
  }

  @Post('homework/:id/send-to-parents')
  @Roles(Role.TEACHER)
  async sendHomeworkToParents(@Req() req: any, @Param('id') id: string) {
    return this.portalService.sendHomeworkToParents(req.user.sub, req.user.tenantId, id);
  }

  @Get('announcements')
  async getAnnouncements(@Req() req: any) {
    return this.portalService.getAnnouncements(req.user.sub, req.user.tenantId);
  }

  @Post('announcements')
  async createAnnouncement(@Req() req: any, @Body() data: any) {
    return this.portalService.createAnnouncement(req.user.sub, req.user.tenantId, data);
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(@Req() req: any, @Param('id') id: string) {
    return this.portalService.deleteAnnouncement(req.user.sub, req.user.tenantId, id);
  }

  @Post('announcements/:id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.portalService.markAnnouncementAsRead(req.user.sub, req.user.tenantId, id);
  }

  @Get('leave')
  async getLeaves(@Req() req: any) {
    return this.portalService.getLeaveRequests(req.user.sub, req.user.tenantId);
  }

  @Post('leave')
  @Roles(Role.TEACHER)
  async applyLeave(@Req() req: any, @Body() data: any) {
    return this.portalService.applyLeave(req.user.sub, req.user.tenantId, data);
  }

  @Delete('leave/:id')
  @Roles(Role.TEACHER)
  async cancelLeave(@Req() req: any, @Param('id') id: string) {
    return this.portalService.cancelLeave(req.user.sub, req.user.tenantId, id);
  }

  @Patch('leave/:id/status')
  @Roles(Role.SCHOOL_ADMIN)
  async updateLeaveStatus(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.portalService.updateLeaveStatus(req.user.sub, req.user.tenantId, id, data);
  }

  @Get('communication/audience')
  @Roles(Role.TEACHER)
  async getCommAudience(@Req() req: any) {
    return this.portalService.getCommunicationAudience(req.user.sub, req.user.tenantId);
  }

  @Post('communication/send')
  @Roles(Role.TEACHER)
  async sendBroadcast(@Req() req: any, @Body() data: any) {
    return this.portalService.sendBroadcastMessage(req.user.sub, req.user.tenantId, data);
  }

  @Get('calendar')
  @Roles(Role.TEACHER)
  async getCalendar(
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.portalService.getCalendarTimeline(
      req.user.sub,
      req.user.tenantId,
      parseInt(month, 10),
      parseInt(year, 10),
    );
  }

  @Get('student-progress/:studentId')
  @Roles(Role.TEACHER)
  async getStudentProgress(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getStudentProgressDetails(req.user.sub, req.user.tenantId, studentId);
  }

  @Get('salary/details')
  @Roles(Role.TEACHER)
  async getSalaryDetails(@Req() req: any) {
    return this.portalService.getMySalaryDetails(req.user.sub, req.user.tenantId);
  }

  @Get('salary/history')
  @Roles(Role.TEACHER)
  async getSalaryHistory(@Req() req: any) {
    return this.portalService.getMySalaryHistory(req.user.sub, req.user.tenantId);
  }

  @Get('salary/payslip/:expenseId')
  @Roles(Role.TEACHER)
  async getPayslipData(@Req() req: any, @Param('expenseId') expenseId: string) {
    return this.portalService.getPayslipPDFData(req.user.sub, req.user.tenantId, expenseId);
  }
}
