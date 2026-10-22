import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Controller('api/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @Get('current')
  async getCurrent(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.subscriptionService.checkSubscriptionStatus(tenantId);
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.subscriptionService.getPaymentHistory(tenantId);
  }

  @Get('invoices')
  async getInvoices(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.subscriptionService.getInvoices(tenantId);
  }
}
