import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LeaveManagementService } from './leave-management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SCHOOL_ADMIN)
@Controller('leave-management')
export class LeaveManagementController {
  constructor(private leaveManagementService: LeaveManagementService) {}

  @Get()
  async getLeaves(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('applicantType') applicantType?: string,
    @Query('leaveType') leaveType?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.leaveManagementService.getLeaveRequests(req.user.sub, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      applicantType,
      leaveType,
      academicYearId,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  async getLeaveStats() {
    return this.leaveManagementService.getLeaveStats();
  }

  @Get('history/:applicantType/:applicantId')
  async getApplicantLeaveHistory(
    @Param('applicantType') applicantType: string,
    @Param('applicantId') applicantId: string,
  ) {
    return this.leaveManagementService.getApplicantLeaveHistory(applicantType, applicantId);
  }

  @Patch(':id/status')
  async updateLeaveStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { status: string; comments?: string },
  ) {
    return this.leaveManagementService.updateLeaveStatus(req.user.sub, id, data);
  }

  @Post('bulk-status')
  async bulkUpdateLeaveStatus(
    @Req() req: any,
    @Body() data: { ids: string[]; status: string; comments?: string },
  ) {
    return this.leaveManagementService.bulkUpdateLeaveStatus(req.user.sub, data.ids, {
      status: data.status,
      comments: data.comments,
    });
  }
}
