import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SaaSInvoiceStatus } from '@prisma/client';

@Injectable()
export class SaaSBillingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dynamic platform payment settings or return fallback defaults.
   */
  async getPaymentSettings() {
    let settings = await this.prisma.paymentSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.paymentSettings.create({
        data: {
          companyName: 'EduTrack Inc.',
          supportEmail: 'support@edutrack.com',
          supportPhone: '+91 9876543210',
          gstPercentage: 18.0,
          invoicePrefix: 'INV-SUB-',
          invoiceNumberFormat: 'INV-{YYYY}-{MM}-{NUMBER}',
          defaultCurrency: 'INR',
          timeZone: 'Asia/Kolkata',
        },
      });
    }
    return settings;
  }

  /**
   * Calculate invoice total, tax amount (GST), and discounts.
   */
  async calculateInvoiceTotal(amountCents: number, discountCents: number = 0) {
    const settings = await this.getPaymentSettings();
    const gstRate = Number(settings.gstPercentage) / 100;
    
    const taxableAmountCents = Math.max(0, amountCents - discountCents);
    const taxCents = Math.round(taxableAmountCents * gstRate);
    const totalCents = taxableAmountCents + taxCents;

    return {
      subtotalCents: amountCents,
      discountCents,
      taxableAmountCents,
      taxCents,
      gstPercentage: Number(settings.gstPercentage),
      totalCents,
      currency: settings.defaultCurrency,
    };
  }

  /**
   * Create an invoice record with immutable PaymentSettings snapshot.
   */
  async createInvoice(tenantId: string, planId: any, amountCents: number, discountCents: number = 0) {
    const settings = await this.getPaymentSettings();
    const calculation = await this.calculateInvoiceTotal(amountCents, discountCents);

    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `${settings.invoicePrefix}${dateStr}-${randomSeq}`;

    // Snapshot PaymentSettings at creation time for immutable historical record
    const snapshotData = {
      companyName: settings.companyName,
      companyLogoUrl: settings.companyLogoUrl,
      address: settings.address,
      website: settings.website,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      gstNumber: settings.gstNumber,
      panNumber: settings.panNumber,
      gstPercentage: settings.gstPercentage,
      bankName: settings.bankName,
      accountName: settings.accountName,
      accountNumber: settings.accountNumber,
      ifscCode: settings.ifscCode,
      branchName: settings.branchName,
      upiId: settings.upiId,
      footer: settings.footer,
      termsAndConditions: settings.termsAndConditions,
      calculation,
    };

    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        planId,
        amount: calculation.totalCents / 100,
        gst: calculation.taxCents / 100,
        currency: calculation.currency,
        status: SaaSInvoiceStatus.GENERATED,
        snapshotData,
        downloadUrl: `/api/v1/billing/invoices/${invoiceNumber}/pdf`,
      },
    });

    const billing = await this.prisma.subscriptionBilling.create({
      data: {
        subscriptionId: tenantId,
        invoiceId: invoice.id,
        amountCents: calculation.subtotalCents,
        taxCents: calculation.taxCents,
        discountCents: calculation.discountCents,
      },
    });

    return { invoice, billing, calculation };
  }

  /**
   * Hook for processing refunds (Future proofing).
   */
  async processRefundHook(paymentId: string, refundAmountCents: number, reason: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment '${paymentId}' not found.`);
    }

    return this.prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        failureReason: `Refund processed: ${reason} (Amount: ${refundAmountCents / 100})`,
      },
    });
  }
}
