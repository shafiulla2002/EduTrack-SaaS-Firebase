import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SaaSBillingService } from '../saas-billing/saas-billing.service';
import { SUBSCRIPTION_PLANS, SubscriptionPlanDefinition } from '../common/config/subscription-plans.config';
import { SaaSPaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
    private billingService: SaaSBillingService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify Razorpay HMAC-SHA256 signature against secret.
   */
  verifySignature(payloadText: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadText)
      .digest('hex');
    return expectedSignature === signature;
  }

  /**
   * Idempotent webhook handler for Razorpay payment events.
   */
  async processRazorpayWebhook(rawBody: string, payload: any, signature: string) {
    const eventId = payload?.event_id || payload?.id || `evt_${Date.now()}`;
    const paymentEntity = payload?.payload?.payment?.entity || payload;
    const gatewayReference = paymentEntity?.id || payload?.payment_id || `pay_${Date.now()}`;

    // 1. Idempotency Check: Reject duplicate webhook events immediately
    const existingPayment = await this.prisma.subscriptionPayment.findFirst({
      where: {
        OR: [
          { eventId },
          { gatewayReference },
        ],
      },
    });

    if (existingPayment && existingPayment.status === SaaSPaymentStatus.SUCCESS) {
      this.logger.log(`Idempotency Hit: Razorpay Event '${eventId}' / Payment '${gatewayReference}' already processed.`);
      return { success: true, idempotent: true, message: 'Event already processed' };
    }

    // 2. Signature Verification (ConfigService only, no hardcoded default fallback string)
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      this.logger.error(`Webhook secret (RAZORPAY_WEBHOOK_SECRET) is not configured in environment.`);
      throw new BadRequestException('Webhook configuration missing or invalid signature');
    }

    const isVerified = this.verifySignature(rawBody, signature, webhookSecret);
    if (!isVerified) {
      this.logger.error(`Signature verification failed for event '${eventId}'.`);
      throw new BadRequestException('Invalid Razorpay signature');
    }

    let tenantId = paymentEntity?.notes?.tenantId || payload?.tenantId;
    let planCode = paymentEntity?.notes?.planCode || payload?.planId || payload?.notes?.planCode;
    let durationMonths = paymentEntity?.notes?.billingMonths ? Number(paymentEntity.notes.billingMonths) : undefined;

    if (!tenantId && paymentEntity?.order_id) {
      const pendingPayment = await this.prisma.subscriptionPayment.findFirst({
        where: { gatewayReference: paymentEntity.order_id },
      });
      if (pendingPayment) {
        tenantId = pendingPayment.tenantId;
        durationMonths = pendingPayment.billingDurationMonths || durationMonths;
        planCode = pendingPayment.planId || planCode;
      }
    }

    // Standardize plan resolution via SUBSCRIPTION_PLANS map
    let planDef: SubscriptionPlanDefinition | undefined;
    if (planCode && SUBSCRIPTION_PLANS[planCode]) {
      planDef = SUBSCRIPTION_PLANS[planCode];
    } else if (durationMonths === 6) {
      planDef = SUBSCRIPTION_PLANS.BASIC_HALF_YEARLY;
    } else if (durationMonths === 12 || !durationMonths) {
      planDef = SUBSCRIPTION_PLANS.BASIC_ANNUAL;
    }

    if (!planDef) {
      this.logger.warn(`Invalid or unmapped planCode '${planCode}' received in webhook payload for event '${eventId}'.`);
      return { success: false, message: `Invalid or unmapped subscription plan code: ${planCode}` };
    }

    durationMonths = planDef.durationMonths;
    planCode = planDef.code;

    const amountCents = paymentEntity?.amount || (payload?.amount ? payload.amount * 100 : planDef.priceInPaise);

    if (!tenantId) {
      this.logger.warn(`TenantId missing in webhook payload for event '${eventId}'.`);
      return { success: false, message: 'Missing tenantId in payload' };
    }

    // 3. Save or update Payment record
    const payment = await this.prisma.subscriptionPayment.upsert({
      where: { transactionId: gatewayReference },
      create: {
        tenantId,
        gateway: 'RAZORPAY',
        gatewayReference,
        eventId,
        amountCents,
        amount: amountCents / 100,
        billingDurationMonths: durationMonths,
        planId: planCode,
        transactionId: gatewayReference,
        status: SaaSPaymentStatus.SUCCESS,
        signatureVerified: isVerified,
        gatewayResponse: payload,
        paidAt: new Date(),
      },
      update: {
        status: SaaSPaymentStatus.SUCCESS,
        signatureVerified: isVerified,
        gatewayResponse: payload,
        paidAt: new Date(),
      },
    });

    // 4. Activate / Renew Tenant Subscription
    let planRecord = await this.prisma.subscriptionPlan.findFirst({
      where: { isActive: true, name: 'BASIC' },
    });
    if (!planRecord) {
      planRecord = await this.prisma.subscriptionPlan.create({
        data: {
          name: 'BASIC',
          studentLimit: 500,
          teacherLimit: 50,
          parentLimit: 1000,
          storageLimit: 1024,
          features: planDef.features,
          price: planDef.priceInINR,
          durationMonths: planDef.durationMonths,
          isDefault: false,
          isActive: true,
        },
      });
    }

    if (tenantId && planRecord) {
      await this.subscriptionService.activateOrRenew(tenantId, planRecord.id, durationMonths);
    }

    // 5. Generate Billing Invoice Record
    await this.billingService.createInvoice(tenantId, planRecord.id, amountCents);

    this.logger.log(`Payment '${gatewayReference}' processed successfully for tenant '${tenantId}' (Plan: ${planCode}, Amount: ₹${amountCents / 100}).`);

    return {
      success: true,
      processed: true,
      paymentId: payment.id,
    };
  }
}

