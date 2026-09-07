import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SaaSBillingService } from './saas-billing.service';

@Controller('api/v1/billing')
export class SaaSBillingController {
  constructor(private readonly billingService: SaaSBillingService) {}

  @Get('settings')
  async getPaymentSettings() {
    return this.billingService.getPaymentSettings();
  }

  @Post('calculate')
  async calculateInvoiceTotal(
    @Body('amountCents') amountCents: number,
    @Body('discountCents') discountCents?: number
  ) {
    return this.billingService.calculateInvoiceTotal(amountCents, discountCents || 0);
  }

  @Post('invoices')
  async createInvoice(
    @Body('tenantId') tenantId: string,
    @Body('planId') planId: any,
    @Body('amountCents') amountCents: number,
    @Body('discountCents') discountCents?: number
  ) {
    return this.billingService.createInvoice(tenantId, planId, amountCents, discountCents || 0);
  }
}
