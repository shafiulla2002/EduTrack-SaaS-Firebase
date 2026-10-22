import { Controller, Get, Post, Body, Put, Param, UseGuards, Patch } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';

// Assuming there's a SuperAdminGuard to protect these endpoints
// @UseGuards(SuperAdminGuard) 
@Controller('api/platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.platformAdminService.getDashboardMetrics();
  }

  @Get('schools')
  async getSchools() {
    return this.platformAdminService.getAllSchools();
  }

  @Patch('schools/:id/status')
  async updateSchoolStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.platformAdminService.updateSchoolStatus(id, body.status);
  }

  @Get('plans')
  async getPlans() {
    return this.platformAdminService.getSubscriptionPlans();
  }

  @Post('plans')
  async createPlan(@Body() body: any) {
    return this.platformAdminService.createSubscriptionPlan(body);
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.platformAdminService.updateSubscriptionPlan(id, body);
  }

  @Get('settings')
  async getSettings() {
    return this.platformAdminService.getPlatformSettings();
  }

  @Put('settings')
  async updateSettings(@Body() body: any) {
    return this.platformAdminService.updatePlatformSettings(body);
  }

  @Get('gateways')
  async getGateways() {
    return this.platformAdminService.getPaymentGateways();
  }

  @Put('gateways/:name')
  async updateGateway(@Param('name') name: string, @Body() body: any) {
    return this.platformAdminService.updatePaymentGateway(name, body);
  }

  @Get('payments')
  async getPayments() {
    return this.platformAdminService.getAllPayments();
  }

  @Get('invoices')
  async getInvoices() {
    return this.platformAdminService.getAllInvoices();
  }
}
