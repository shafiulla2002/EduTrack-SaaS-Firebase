import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getRazorpayInstance() {
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });
    
    // In a real scenario, use decrypt(config.keyId) and decrypt(config.keySecret)
    // Here we'll just mock it or assume it's stored plain for testing if decryption is complex, 
    // but requirement said encrypted. We will use the common crypto util we made.
    // For now, let's just get the instance assuming we have it.
    
    // Import here to avoid circular dep if needed, but we can use normal import
    const { decrypt } = require('../../common/utils/crypto.util');

    if (!config || !config.isActive) {
      throw new BadRequestException('Razorpay is not configured or not active');
    }

    const key_id = decrypt(config.keyId);
    const key_secret = decrypt(config.keySecret);

    if (!key_id || !key_secret) {
        throw new InternalServerErrorException('Razorpay credentials could not be decrypted');
    }

    return new (Razorpay as any)({
      key_id,
      key_secret,
    });
  }

  async createOrder(tenantId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');

    const amount = Number(plan.price);
    const gst = amount * 0.18; // 18% GST for India
    const total = amount + gst;

    const rzp = await this.getRazorpayInstance();

    const orderOptions = {
      amount: Math.round(total * 100), // amount in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    };

    let rzpOrder;
    try {
      rzpOrder = await rzp.orders.create(orderOptions);
    } catch (e) {
      this.logger.error('Failed to create Razorpay order', e);
      throw new InternalServerErrorException('Payment gateway error');
    }

    const subscriptionOrder = await this.prisma.subscriptionOrder.create({
      data: {
        tenantId,
        planId,
        amount,
        gst,
        total,
        gateway: 'RAZORPAY',
        status: 'PENDING',
        // In real app, we might store rzpOrder.id in a separate field, but we can rely on transaction tracking
        id: rzpOrder.id // Overriding ID to match RZP for ease, or store it. Let's use it as ID!
      },
    });

    return {
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      total,
      plan: plan.name,
    };
  }

  async verifyPaymentWebhook(signature: string, payload: any) {
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });

    const { decrypt } = require('../../common/utils/crypto.util');
    const secret = decrypt(config?.webhookSecret || '');

    if (!secret) throw new BadRequestException('Webhook secret not found');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    const event = payload.event;
    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      await this.handleSuccessfulPayment(payment);
    }

    return { status: 'ok' };
  }

  private async handleSuccessfulPayment(payment: any) {
    const orderId = payment.order_id;
    const order = await this.prisma.subscriptionOrder.findUnique({ where: { id: orderId } });
    
    if (!order || order.status === 'PAID') return; // Already processed

    await this.prisma.subscriptionOrder.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    await this.prisma.subscriptionPayment.create({
      data: {
        orderId,
        transactionId: payment.id,
        paymentId: payment.id,
        gateway: 'RAZORPAY',
        amount: order.amount,
        gst: order.gst,
        webhookResponse: payment,
        paymentStatus: 'SUCCESS',
        paidDate: new Date(),
      },
    });

    // Activate Subscription
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: order.planId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: order.tenantId } });

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (plan.duration || 6));

    await this.prisma.subscription.create({
      data: {
        tenantId: order.tenantId,
        planId: order.planId,
        startDate,
        expiryDate,
        status: 'ACTIVE',
        paymentReference: payment.id,
      },
    });

    // Generate Invoice
    await this.generateInvoice(order, payment.id, tenant, plan);
  }

  private async generateInvoice(order: any, paymentId: string, tenant: any, plan: any) {
    const invoiceNumber = `INV-${Date.now()}`;
    const invoiceDate = new Date();
    
    const invoicePath = path.join(__dirname, '..', '..', '..', 'public', 'invoices');
    if (!fs.existsSync(invoicePath)) {
      fs.mkdirSync(invoicePath, { recursive: true });
    }

    const fileName = `${invoiceNumber}.pdf`;
    const fullPath = path.join(invoicePath, fileName);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(fullPath));

    // Basic PDF styling
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
    doc.text(`Date: ${invoiceDate.toLocaleDateString()}`);
    doc.moveDown();
    doc.text(`Billed To: ${tenant.name}`);
    doc.text(`Plan: ${plan.name}`);
    doc.moveDown();
    doc.text(`Amount: ₹${order.amount}`);
    doc.text(`GST (18%): ₹${order.gst}`);
    doc.text(`Total: ₹${order.total}`);
    doc.moveDown();
    doc.text(`Payment ID: ${paymentId}`);
    doc.text(`Status: PAID`);
    
    doc.end();

    await this.prisma.subscriptionInvoice.create({
      data: {
        invoiceNumber,
        tenantId: tenant.id,
        schoolName: tenant.name,
        planName: plan.name,
        amount: order.amount,
        gst: order.gst,
        total: order.total,
        paymentId,
        gateway: 'RAZORPAY',
        invoicePdf: `/invoices/${fileName}`,
        invoiceDate,
      },
    });
  }
}
