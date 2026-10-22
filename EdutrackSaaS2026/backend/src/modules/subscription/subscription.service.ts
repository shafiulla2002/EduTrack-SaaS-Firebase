import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async assignFreePlanToNewTenant(tenantId: string) {
    let freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Free Plan' },
    });

    if (!freePlan) {
      freePlan = await this.prisma.subscriptionPlan.create({
        data: {
          name: 'Free Plan',
          price: 0,
          duration: 6, // 6 months
          features: ['All standard features'],
        },
      });
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: freePlan.id,
        startDate,
        expiryDate,
        status: 'ACTIVE',
      },
    });

    return subscription;
  }

  async getCurrentSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      include: { SubscriptionPlan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { status: 'ACTIVE' },
    });
  }

  async getPaymentHistory(tenantId: string) {
    return this.prisma.subscriptionOrder.findMany({
      where: { tenantId },
      include: {
        SubscriptionPlan: true,
        SubscriptionPayment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoices(tenantId: string) {
    return this.prisma.subscriptionInvoice.findMany({
      where: { tenantId },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async checkSubscriptionStatus(tenantId: string) {
    const sub = await this.getCurrentSubscription(tenantId);
    if (sub.expiryDate < new Date() && sub.status === 'ACTIVE') {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });
      return { ...sub, status: 'EXPIRED' };
    }
    return sub;
  }
}
