import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SaaSBillingService } from '../saas-billing/saas-billing.service';
import { SaaSPaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
    private billingService: SaaSBillingService,
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

    // 2. Signature Verification
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'edutrack_webhook_secret_dev';
    const isVerified = this.verifySignature(rawBody, signature, webhookSecret);

    if (!isVerified && process.env.NODE_ENV === 'production') {
      this.logger.error(`Signature verification failed for event '${eventId}'.`);
      throw new BadRequestException('Invalid Razorpay signature');
    }

    const tenantId = paymentEntity?.notes?.tenantId || payload?.tenantId;
    const planId = paymentEntity?.notes?.planId || payload?.planId;
    const amountCents = paymentEntity?.amount || (payload?.amount ? payload.amount * 100 : 0);

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
    if (planId) {
      await this.subscriptionService.activateOrRenew(tenantId, planId, 12);
    }

    // 5. Generate Billing Invoice Record
    await this.billingService.createInvoice(tenantId, planId, amountCents);

    this.logger.log(`Payment '${gatewayReference}' processed successfully for tenant '${tenantId}'.`);

    return {
      success: true,
      processed: true,
      paymentId: payment.id,
    };
  }
}
