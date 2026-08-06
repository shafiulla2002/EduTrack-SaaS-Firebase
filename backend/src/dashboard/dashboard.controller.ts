import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  @Get('summary')
  async getDashboardSummary() {
    return this.dashboardService.getDashboardSummary();
  }

  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get('reports')
  async getReportsSummary(@Req() req: any) {
    return this.dashboardService.getReportsSummary(req.user.sub, req.user.role);
  }

  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get('reports/demographics')
  async getDemographicsReport(@Req() req: any) {
    return this.dashboardService.getDemographicsReport(req.user.sub, req.user.role);
  }

  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get('reports/cashflows')
  async getCashflowsReport(@Req() req: any) {
    return this.dashboardService.getCashflowsReport(req.user.sub, req.user.role);
  }

  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get('reports/grading')
  async getGradingReport(@Req() req: any) {
    return this.dashboardService.getGradingReport(req.user.sub, req.user.role);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('platform/metrics')
  async getPlatformMetrics() {
    return this.dashboardService.getPlatformMetrics();
  }
}

