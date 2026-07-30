import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
@Controller('parent-portal')
export class ParentPortalController {
  constructor(private portalService: ParentPortalService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    return this.portalService.getDashboardStats(req.user.sub, req.user.tenantId);
  }

  @Get('children')
  async getChildren(@Req() req: any) {
    return this.portalService.getChildren(req.user.sub);
  }

  @Get('children/:studentId/dashboard')
  async getChildDashboard(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getChildDashboard(req.user.sub, studentId);
  }

  @Get('children/:studentId/attendance')
  async getAttendance(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getAttendance(req.user.sub, studentId);
  }

  @Get('children/:studentId/homework')
  async getHomework(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getHomework(req.user.sub, studentId);
  }

  @Post('children/:studentId/homework/:homeworkId/submit')
  async submitAssignment(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('homeworkId') homeworkId: string,
    @Body() data: any
  ) {
    return this.portalService.submitAssignment(
      req.user.sub,
      studentId,
      homeworkId,
      data.base64File,
      data.fileName,
    );
  }

  @Get('children/:studentId/exams')
  async getExams(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getExams(req.user.sub, studentId);
  }

  @Get('children/:studentId/fees')
  async getFees(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getFees(req.user.sub, studentId);
  }

  @Post('children/:studentId/invoices/:invoiceId/pay')
  async payInvoice(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() data: any
  ) {
    return this.portalService.payInvoice(req.user.sub, studentId, invoiceId, data);
  }

  @Get('children/:studentId/invoices/:invoiceId/pdf/download')
  async downloadInvoicePdf(
    @Req() req: any,
    @Res() res: any,
    @Param('studentId') studentId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.portalService.generateInvoicePdf(req.user.sub, studentId, invoiceId, res);
  }

  @Get('children/:studentId/timetable')
  async getTimetable(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getTimetable(req.user.sub, studentId);
  }

  @Get('children/:studentId/announcements')
  async getAnnouncements(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getAnnouncements(req.user.sub, studentId);
  }

  @Get('complaints')
  async getComplaints(@Req() req: any) {
    return this.portalService.getComplaints(req.user.sub);
  }

  @Post('complaints')
  async submitComplaint(@Req() req: any, @Body() data: any) {
    return this.portalService.submitComplaint(req.user.sub, req.user.tenantId, data);
  }

  @Get('children/:studentId/transport')
  async getTransport(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getTransport(req.user.sub, studentId);
  }

  @Get('children/:studentId/leave')
  async getLeavesHistory(@Req() req: any, @Param('studentId') studentId: string) {
    return this.portalService.getLeavesHistory(req.user.sub, studentId);
  }

  @Post('children/:studentId/leave')
  async submitLeaveRequest(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Body() data: any
  ) {
    return this.portalService.submitLeaveRequest(req.user.sub, studentId, data);
  }
}
