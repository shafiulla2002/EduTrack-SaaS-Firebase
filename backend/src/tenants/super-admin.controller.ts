import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';
import { Role, PlanType, SubscriptionStatus, SaaSInvoiceStatus, SaaSPaymentStatus } from '@prisma/client';
import { encrypt } from '../common/utils/encryption.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private prisma: PrismaService) {}

  @Get('tenants')
  async listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        subscription: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('tenants/:id/subscription')
  async updateSubscription(
    @Param('id') id: string,
    @Body('planName') planName: PlanType,
    @Body('expiryDate') expiryDate?: string,
    @Body('status') status?: SubscriptionStatus,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) {
      throw new NotFoundException(`Plan ${planName} not found`);
    }

    const currentSub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: id },
      include: { plan: true },
    });

    if (!currentSub) {
      throw new NotFoundException(`Subscription record not found for tenant ${id}`);
    }

    const updateData: any = {
      planId: plan.id,
    };
    if (expiryDate) {
      updateData.expiryDate = new Date(expiryDate);
    }
    if (status) {
      updateData.status = status;
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { tenantId: id },
      data: updateData,
      include: { plan: true },
    });

    // Create SubscriptionHistory entry for audit trail
    await this.prisma.subscriptionHistory.create({
      data: {
        tenantId: id,
        previousPlan: currentSub.plan.name,
        newPlan: plan.name,
        amount: 0.0, // Manual Super Admin adjustment
        paymentMethod: 'SUPER_ADMIN_MANUAL',
        transactionReference: 'ADJ-' + Date.now(),
        startDate: currentSub.startDate,
        expiryDate: updateData.expiryDate || currentSub.expiryDate,
        status: status || SubscriptionStatus.ACTIVE,
      },
    });

    return updated;
  }

  @Get('billing/payments')
  async listPayments() {
    return this.prisma.subscriptionPayment.findMany({
      include: {
        tenant: { select: { name: true, subDomain: true } },
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('billing/invoices/generate')
  async generateInvoice(
    @Body('tenantId') tenantId: string,
    @Body('planName') planName: PlanType,
    @Body('amount') amount: number,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const invoiceNumber = 'INV-SUB-MAN-' + Date.now().toString().slice(-6);
    return this.prisma.subscriptionInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        planId: planName,
        amount,
        gst: Number(amount) * 0.18,
        currency: 'INR',
        status: SaaSInvoiceStatus.GENERATED,
        pdfUrl: `/billing/invoices/subscription/${invoiceNumber}.pdf`,
      },
    });
  }

  @Get('dashboard/stats')
  async getStats() {
    const totalSchools = await this.prisma.tenant.count();

    const subscriptions = await this.prisma.tenantSubscription.findMany({
      include: { plan: true },
    });

    const activeTrials = subscriptions.filter(
      s => s.status === SubscriptionStatus.ACTIVE && s.plan.name === PlanType.TRIAL,
    ).length;
    
    const activePaid = subscriptions.filter(
      s => s.status === SubscriptionStatus.ACTIVE && s.plan.name !== PlanType.TRIAL,
    ).length;

    const expired = subscriptions.filter(s => s.status === SubscriptionStatus.EXPIRED).length;
    const grace = subscriptions.filter(
      s => s.status === SubscriptionStatus.PAST_DUE || (s.status as string) === 'GRACE_PERIOD',
    ).length;

    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { status: SaaSPaymentStatus.SUCCESS },
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Calculate total revenue from all successful payments
    const allSuccessfulPayments = await this.prisma.subscriptionPayment.findMany({
      where: { status: SaaSPaymentStatus.SUCCESS },
      select: { amount: true },
    });

    const totalRevenue = allSuccessfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const planDistribution = subscriptions.reduce((acc, sub) => {
      acc[sub.plan.name] = (acc[sub.plan.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSchools,
      activeTrials,
      activePaid,
      expired,
      grace,
      totalRevenue,
      planDistribution,
      recentPayments: payments.map(p => ({
        id: p.id,
        schoolName: p.tenant.name,
        amount: p.amount,
        gateway: p.gateway,
        paidAt: p.paidAt,
        transactionId: p.transactionId,
      })),
    };
  }

  @Get('plans')
  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  @Post('plans')
  async createPlan(@Body() body: any) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: body.name,
        price: body.price,
        features: body.features || [],
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() body: any) {
    const updateData: any = {};
    if (body.price !== undefined) updateData.price = body.price;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });
  }

  // --- Platform Settings ---
  @Get('settings')
  async getSettings() {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }
    return settings;
  }

  @Put('settings')
  async updateSettings(@Body() body: any) {
    let settings = await this.prisma.platformSettings.findFirst();
    if (settings) {
      return this.prisma.platformSettings.update({
        where: { id: settings.id },
        data: body,
      });
    } else {
      return this.prisma.platformSettings.create({ data: body });
    }
  }

  // --- Payment Gateway Config ---
  @Get('gateways')
  async getGateways() {
    const gateways = await this.prisma.paymentGatewayConfig.findMany();
    // Mask secrets for frontend
    return gateways.map(g => ({
      ...g,
      apiKey: g.apiKey ? '********' : null,
      apiSecret: g.apiSecret ? '********' : null,
      webhookSecret: g.webhookSecret ? '********' : null,
    }));
  }

  @Put('gateways/:name')
  async updateGateway(@Param('name') name: string, @Body() body: any) {
    const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
    
    const updateData: any = {
      isActive: body.isActive,
    };
    
    if (body.apiKey && body.apiKey !== '********') {
      updateData.apiKey = encrypt(body.apiKey, secretKey);
    }
    if (body.apiSecret && body.apiSecret !== '********') {
      updateData.apiSecret = encrypt(body.apiSecret, secretKey);
    }
    if (body.webhookSecret && body.webhookSecret !== '********') {
      updateData.webhookSecret = encrypt(body.webhookSecret, secretKey);
    }

    return this.prisma.paymentGatewayConfig.upsert({
      where: { gatewayName: name.toUpperCase() },
      create: {
        gatewayName: name.toUpperCase(),
        ...updateData,
      },
      update: updateData,
    });
  }
}
