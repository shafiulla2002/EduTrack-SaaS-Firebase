import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionStatus, PlanType } from '@prisma/client';

export const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.TRIAL]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.EXPIRED, SubscriptionStatus.RENEWED, SubscriptionStatus.CANCELLED, SubscriptionStatus.SUSPENDED],
  [SubscriptionStatus.GRACE_PERIOD]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.RENEWED, SubscriptionStatus.EXPIRED, SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.RENEWED, SubscriptionStatus.ACTIVE, SubscriptionStatus.SUSPENDED],
  [SubscriptionStatus.RENEWED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED, SubscriptionStatus.SUSPENDED],
  [SubscriptionStatus.CANCELLED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.RENEWED],
  [SubscriptionStatus.SUSPENDED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.RENEWED, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED],
};

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate state transition according to explicit subscription state machine.
   */
  validateStateTransition(currentStatus: SubscriptionStatus, targetStatus: SubscriptionStatus): boolean {
    const allowed = VALID_SUBSCRIPTION_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Transition subscription state safely.
   */
  async transitionStatus(
    tenantId: string,
    targetStatus: SubscriptionStatus,
    reason?: string
  ) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription for tenant '${tenantId}' not found.`);
    }

    if (!this.validateStateTransition(subscription.status, targetStatus)) {
      throw new BadRequestException(
        `Invalid subscription status transition from '${subscription.status}' to '${targetStatus}'.`
      );
    }

    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: {
        status: targetStatus,
        updatedAt: new Date(),
      },
      include: { plan: true },
    });
  }

  /**
   * Activate or renew a school subscription.
   */
  async activateOrRenew(
    tenantId: string,
    planId: string,
    durationMonths: number = 12
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan '${planId}' not found.`);
    }

    const currentSub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });

    let startDate = new Date();
    let expiryDate = new Date();

    if (currentSub && currentSub.expiryDate > new Date()) {
      startDate = new Date(currentSub.startDate);
      expiryDate = new Date(currentSub.expiryDate);
    }

    expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

    const gracePeriodEndDate = new Date(expiryDate);
    gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 14); // 14-day grace period

    const targetStatus = currentSub && currentSub.status === SubscriptionStatus.ACTIVE
      ? SubscriptionStatus.RENEWED
      : SubscriptionStatus.ACTIVE;

    if (currentSub) {
      return this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          planId: plan.id,
          startDate,
          expiryDate,
          gracePeriodEndDate,
          status: targetStatus,
        },
        include: { plan: true },
      });
    } else {
      return this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          startDate,
          expiryDate,
          gracePeriodEndDate,
          status: SubscriptionStatus.TRIAL,
        },
        include: { plan: true },
      });
    }
  }

  /**
   * Get tenant subscription details.
   */
  async getSubscriptionDetails(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
        billingRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found for tenant '${tenantId}'.`);
    }

    const now = new Date();
    const remainingDays = Math.max(0, Math.ceil((subscription.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      ...subscription,
      remainingDays,
      isExpired: now > subscription.expiryDate,
      isInGracePeriod: subscription.gracePeriodEndDate ? (now > subscription.expiryDate && now <= subscription.gracePeriodEndDate) : false,
    };
  }
}
