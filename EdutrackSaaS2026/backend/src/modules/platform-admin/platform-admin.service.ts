import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const totalSchools = await this.prisma.tenant.count();
    const activeSubscriptions = await this.prisma.subscription.count({ where: { status: 'ACTIVE' } });
    const totalRevenueResult = await this.prisma.subscriptionOrder.aggregate({
      where: { status: 'PAID' },
      _sum: { total: true },
    });
    
    return {
      totalSchools,
      activeSubscriptions,
      totalRevenue: totalRevenueResult._sum.total || 0,
    };
  }

  async getAllSchools() {
    return this.prisma.tenant.findMany({
      include: {
        Subscription: true,
      },
    });
  }

  async updateSchoolStatus(tenantId: string, status: string) {
    // Implement activate/suspend logic
    return this.prisma.subscription.updateMany({
      where: { tenantId },
      data: { status: status as any }, // 'ACTIVE' or 'SUSPENDED'
    });
  }

  async getSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany();
  }

  async createSubscriptionPlan(data: any) {
    return this.prisma.subscriptionPlan.create({ data });
  }

  async updateSubscriptionPlan(id: string, data: any) {
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findFirst();
    return settings || {};
  }

  async updatePlatformSettings(data: any) {
    let settings = await this.prisma.platformSettings.findFirst();
    if (settings) {
      return this.prisma.platformSettings.update({ where: { id: settings.id }, data });
    } else {
      return this.prisma.platformSettings.create({ data });
    }
  }

  async getPaymentGateways() {
    const gateways = await this.prisma.paymentGatewayConfig.findMany();
    // Do not return decrypted secrets in API response, just indicate if they exist
    return gateways.map(gw => ({
      ...gw,
      keySecret: gw.keySecret ? '******' : null,
      webhookSecret: gw.webhookSecret ? '******' : null,
    }));
  }

  async updatePaymentGateway(gatewayName: string, data: any) {
    let config = await this.prisma.paymentGatewayConfig.findUnique({ where: { gatewayName } });
    
    const updateData: any = {
      merchantName: data.merchantName,
      mode: data.mode,
      isActive: data.isActive,
    };

    if (data.keyId) updateData.keyId = encrypt(data.keyId);
    if (data.keySecret && data.keySecret !== '******') updateData.keySecret = encrypt(data.keySecret);
    if (data.webhookSecret && data.webhookSecret !== '******') updateData.webhookSecret = encrypt(data.webhookSecret);

    if (config) {
      return this.prisma.paymentGatewayConfig.update({ where: { id: config.id }, data: updateData });
    } else {
      return this.prisma.paymentGatewayConfig.create({
        data: {
          gatewayName,
          ...updateData
        },
      });
    }
  }

  async getAllPayments() {
    return this.prisma.subscriptionPayment.findMany({
      include: { SubscriptionOrder: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllInvoices() {
    return this.prisma.subscriptionInvoice.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
