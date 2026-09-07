import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatus } from '@prisma/client';

@Controller('api/v1/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':tenantId')
  async getSubscriptionDetails(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.getSubscriptionDetails(tenantId);
  }

  @Post(':tenantId/transition')
  async transitionStatus(
    @Param('tenantId') tenantId: string,
    @Body('status') status: SubscriptionStatus,
    @Body('reason') reason?: string
  ) {
    return this.subscriptionService.transitionStatus(tenantId, status, reason);
  }

  @Post(':tenantId/activate')
  async activateOrRenew(
    @Param('tenantId') tenantId: string,
    @Body('planId') planId: string,
    @Body('durationMonths') durationMonths?: number
  ) {
    return this.subscriptionService.activateOrRenew(tenantId, planId, durationMonths || 12);
  }
}
