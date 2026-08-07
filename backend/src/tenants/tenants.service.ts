import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Tenant, PlanType, SubscriptionStatus, SaaSPaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PaymentService } from '../common/services/payment.service';
import { generateInvoicePDF } from '../common/utils/pdf.util';
import * as path from 'path';
import Razorpay from 'razorpay';
import { decrypt } from '../common/utils/encryption.util';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  private subdomainCache = new Map<string, { tenant: Tenant; expiresAt: number }>();

  async findBySubdomain(subDomain: string): Promise<Tenant> {
    const nowTime = Date.now();
    const cached = this.subdomainCache.get(subDomain);
    if (cached && cached.expiresAt > nowTime) {
      return cached.tenant;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { subDomain },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with subdomain '${subDomain}' not found`);
    }

    this.subdomainCache.set(subDomain, {
      tenant,
      expiresAt: nowTime + 5 * 60 * 1000, // Cache subdomain mapping for 5 minutes
    });

    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }
    return tenant;
  }

  async create(name: string, subDomain: string): Promise<Tenant> {
    const existing = await this.prisma.tenant.findUnique({
      where: { subDomain },
    });
    if (existing) {
      throw new ConflictException(`Subdomain '${subDomain}' is already registered`);
    }
    return this.prisma.tenant.create({
      data: {
        name,
        subDomain,
      },
    });
  }

  async findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: any): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async registerTenant(data: any): Promise<any> {
    const normalizedPhone = data.mobileNumber.replace(/\D/g, '').slice(-10);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        phone: {
          endsWith: normalizedPhone,
        },
      },
    });
    if (existingUser) {
      throw new ConflictException('A user with this mobile number is already registered. Please log in instead.');
    }

    const slug = data.schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let subDomain = slug;
    let exists = await this.prisma.tenant.findUnique({ where: { subDomain } });
    let counter = 1;
    while (exists) {
      subDomain = `${slug}-${counter}`;
      exists = await this.prisma.tenant.findUnique({ where: { subDomain } });
      counter++;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve selected subscription plan details
      const selectedPlanName = data.subscriptionPlan ? data.subscriptionPlan.toUpperCase() : 'TRIAL';
      const plan = await tx.subscriptionPlan.findUnique({
        where: { name: selectedPlanName as any }
      });
      if (!plan) {
        throw new NotFoundException(`Subscription plan '${selectedPlanName}' not found`);
      }

      // 2. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.schoolName,
          subDomain,
          address: data.address,
          email: data.email,
          phone: normalizedPhone,
          setupCompleted: false,
        },
      });

      // 3. Create SchoolSetup
      const schoolSetup = await tx.schoolSetup.create({
        data: {
          tenantId: tenant.id,
          schoolName: data.schoolName,
          schoolType: data.schoolType,
          adminName: data.adminName,
          mobileNumber: normalizedPhone,
          email: data.email,
          address: data.address,
          academicYear: data.academicYear,
        },
      });

      // 4. Create default active AcademicYear
      const currentYear = new Date().getFullYear();
      const startDate = new Date(`${currentYear}-06-01`);
      const endDate = new Date(`${currentYear + 1}-05-31`);

      const academicYear = await tx.academicYear.create({
        data: {
          name: data.academicYear,
          startDate,
          endDate,
          isActive: true,
          tenantId: tenant.id,
        },
      });

      // 5. Create default Tenant Admin User (SCHOOL_ADMIN)
      const randomPassword = Math.random().toString(36).slice(-10) + '!A1';
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const user = await tx.user.create({
        data: {
          name: data.adminName,
          email: data.email,
          phone: normalizedPhone,
          passwordHash,
          role: 'SCHOOL_ADMIN',
          tenantId: tenant.id,
        },
      });

      // 6. Create default StaffProfile for the Admin user
      await tx.staffProfile.create({
        data: {
          userId: user.id,
          designation: 'Principal',
          status: 'Active',
          tenantId: tenant.id,
        },
      });

      // 7. Initialize Tenant Subscription
      const expiryDate = new Date();
      if (plan.name === PlanType.TRIAL) {
        expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 Months Free Trial
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 Month Standard billing
      }

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          expiryDate: expiryDate,
          status: SubscriptionStatus.ACTIVE,
        }
      });

      // 8. Create first SubscriptionHistory record
      await tx.subscriptionHistory.create({
        data: {
          tenantId: tenant.id,
          previousPlan: null,
          newPlan: plan.name,
          amount: plan.price,
          paymentMethod: 'SYSTEM_ONBOARD',
          transactionReference: 'ONBOARD_REGISTRATION',
          startDate: new Date(),
          expiryDate: expiryDate,
          status: SubscriptionStatus.ACTIVE,
        }
      });

      return {
        tenant,
        schoolSetup,
        academicYear,
        user,
      };
    }, { timeout: 30000 });
  }

  async getSubscriptionStatus(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for this tenant');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const setup = await this.prisma.schoolSetup.findUnique({
      where: { tenantId },
    });

    const now = new Date();
    const expiry = new Date(subscription.expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Get current usage counts
    const studentUsage = await this.prisma.studentProfile.count({ where: { tenantId } });
    const teacherUsage = await this.prisma.staffProfile.count({
      where: {
        tenantId,
        user: { role: { in: ['TEACHER', 'STAFF'] } }
      }
    });
    const parentUsage = await this.prisma.parentProfile.count({
      where: {
        user: { tenantId }
      }
    });

    // Query Invoice and Payment History
    const invoices = await this.prisma.subscriptionInvoice.findMany({
      where: { tenantId },
      orderBy: { createdDate: 'desc' }
    });

    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { tenantId },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' }
    });

    return {
      plan: subscription.plan.name,
      status: subscription.status,
      expiryDate: subscription.expiryDate,
      remainingDays,
      studentUsage,
      teacherUsage,
      parentUsage,
      features: subscription.plan.features,
      invoices,
      payments,
      schoolName: setup?.schoolName || tenant?.name || 'School Admin',
      email: setup?.email || tenant?.email || '',
      phone: setup?.mobileNumber || tenant?.phone || '',
      address: setup?.address || tenant?.address || '',
    };
  }

  // ─── Razorpay Order Creation ──────────────────────────────────────────
  async createRazorpayOrder(
    tenantId: string,
    planName: string,
    billingMonths: number,
    baseAmountRs: number,
    couponCode?: string
  ) {
    // Fetch Razorpay credentials from DB
    const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });

    let keyId = 'rzp_test_placeholder';
    let keySecret = 'placeholder_secret';
    if (config && config.isActive && config.apiKey && config.apiSecret) {
      keyId = decrypt(config.apiKey, secretKey);
      keySecret = decrypt(config.apiSecret, secretKey);
    }

    const amountPaise = Math.round(baseAmountRs * 100);
    const receipt = `RCPT_${Date.now()}`;

    let orderId: string;
    if (keyId === 'rzp_test_placeholder') {
      // Dummy mode – no real Razorpay call
      orderId = 'order_dummy_' + Date.now();
    } else {
      const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await instance.orders.create({ amount: amountPaise, currency: 'INR', receipt });
      orderId = order.id as string;
    }

    // Store a PENDING SubscriptionPayment so we can verify later
    const txRef = 'TXN-' + Date.now();
    await this.prisma.subscriptionPayment.create({
      data: {
        tenantId,
        amount: baseAmountRs,
        transactionId: txRef,
        gateway: 'RAZORPAY',
        method: 'RAZORPAY',
        gatewayReference: orderId,
        billingDurationMonths: billingMonths,
        planId: planName,
        status: SaaSPaymentStatus.PENDING,
        gatewayResponse: { orderId, amountPaise, couponCode: couponCode || null },
      },
    });

    return {
      orderId,
      amount: amountPaise,
      currency: 'INR',
      key_id: keyId,
      txRef,
    };
  }

  // ─── Razorpay Signature Verification & Record ─────────────────────────
  async verifyAndRecordPayment(
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    planName: string,
    billingMonths: number,
    finalAmountRs: number,
    couponCode?: string
  ) {
    // Verify HMAC-SHA256 signature
    const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });

    let isDummyMode = false;
    let keySecret = 'placeholder_secret';
    if (config && config.isActive && config.apiSecret) {
      keySecret = decrypt(config.apiSecret, secretKey);
    } else {
      isDummyMode = true;
    }

    let signatureVerified = false;
    if (isDummyMode) {
      // Dummy mode – skip verification
      signatureVerified = true;
    } else {
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      signatureVerified = expectedSignature === razorpaySignature;
    }

    if (!signatureVerified) {
      throw new BadRequestException('Payment signature verification failed. Please contact support.');
    }

    // Find and update the pending payment record
    const pending = await this.prisma.subscriptionPayment.findFirst({
      where: { tenantId, gatewayReference: razorpayOrderId, status: SaaSPaymentStatus.PENDING },
    });

    const txId = razorpayPaymentId || ('dummy_' + Date.now());

    if (pending) {
      await this.prisma.subscriptionPayment.update({
        where: { id: pending.id },
        data: {
          status: SaaSPaymentStatus.PENDING, // Stays PENDING until Super Admin approves
          transactionId: txId,
          signatureVerified,
          paidAt: new Date(),
          gatewayResponse: {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            couponCode: couponCode || null,
          },
        },
      });
    } else {
      // Create a new record if not found
      await this.prisma.subscriptionPayment.create({
        data: {
          tenantId,
          amount: finalAmountRs,
          transactionId: txId,
          gateway: 'RAZORPAY',
          method: 'RAZORPAY',
          gatewayReference: razorpayOrderId,
          billingDurationMonths: billingMonths,
          planId: planName,
          status: SaaSPaymentStatus.PENDING,
          signatureVerified,
          paidAt: new Date(),
          gatewayResponse: {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            couponCode: couponCode || null,
          },
        },
      });
    }

    // Record subscription history as PENDING_APPROVAL
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName as any } });
    if (plan) {
      await this.prisma.subscriptionHistory.create({
        data: {
          tenantId,
          previousPlan: null,
          newPlan: plan.name,
          amount: finalAmountRs,
          paymentMethod: 'RAZORPAY',
          transactionReference: txId,
          startDate: new Date(),
          expiryDate: new Date(Date.now() + billingMonths * 30 * 24 * 60 * 60 * 1000),
          status: SubscriptionStatus.ACTIVE, // Will be activated on approval
        },
      });
    }

    // Send in-app notification to tenant
    await this.prisma.notification.create({
      data: {
        tenantId,
        title: 'Payment Received – Pending Approval',
        message: `Your payment of ₹${finalAmountRs} has been received. Your renewal request is pending Super Admin approval.`,
        type: 'SUBSCRIPTION',
      } as any,
    }).catch(() => {}); // Non-blocking

    return {
      success: true,
      status: 'PENDING_APPROVAL',
      transactionId: txId,
      message: 'Your payment has been received successfully. Your renewal request has been submitted to the Platform Administrator. Approval normally takes a few hours. You will receive a notification once approved.',
    };
  }

  async upgradeOrRenewSubscription(
    tenantId: string,
    planName: PlanType,
    paymentDetails: any,
    userId?: string
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) {
      throw new NotFoundException(`Plan ${planName} not found`);
    }

    const currentSub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    let baseDate = new Date();
    // If current subscription is active and not expired, extend from existing expiry date
    if (currentSub && new Date(currentSub.expiryDate) > new Date()) {
      baseDate = new Date(currentSub.expiryDate);
    }

    const newExpiry = new Date(baseDate);
    const isYearly = paymentDetails?.billingPeriod === 'YEARLY';
    const monthsToExtend = isYearly ? 12 : 1;

    if (plan.name === PlanType.TRIAL) {
      newExpiry.setMonth(newExpiry.getMonth() + 6); // 6 Months
    } else {
      newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend); // Dynamic monthly/yearly extension
    }

    // Determine target checkout amount
    let baseAmount = Number(plan.price);
    if (isYearly && plan.name !== PlanType.TRIAL) {
      // Annual pricing: 10 months price for 12 months (roughly 17% discount)
      baseAmount = Number(plan.price) * 10;
    }

    // Call dynamic Payment Gateway Abstraction layer
    const paymentGateway = paymentDetails?.gateway || 'STRIPE';
    const paymentResponse = await this.paymentService.processCheckout(
      paymentGateway,
      tenantId,
      baseAmount,
      paymentDetails
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Subscription
      const updatedSub = await tx.tenantSubscription.update({
        where: { tenantId },
        data: {
          planId: plan.id,
          expiryDate: newExpiry,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { plan: true },
      });

      // 2. Log History
      await tx.subscriptionHistory.create({
        data: {
          tenantId,
          previousPlan: currentSub ? currentSub.plan.name : null,
          newPlan: plan.name,
          amount: baseAmount,
          paymentMethod: paymentResponse.gateway,
          transactionReference: paymentResponse.transactionId,
          startDate: new Date(),
          expiryDate: newExpiry,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      // 3. Generate SubscriptionInvoice
      const invoiceNumber = 'INV-SUB-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
      const pdfFilePath = path.join(process.cwd(), 'public', 'invoices', `${invoiceNumber}.pdf`);
      
      const invoiceData = {
         invoiceNumber,
         tenantId,
         planId: plan.name,
         amount: baseAmount,
         gst: Number(baseAmount) * 0.18,
         currency: 'INR',
         status: 'PAID',
         createdDate: new Date(),
      };

      await generateInvoicePDF(invoiceData, pdfFilePath);

      const invoice = await tx.subscriptionInvoice.create({
        data: {
          invoiceNumber,
          tenantId,
          planId: plan.name,
          amount: baseAmount,
          gst: Number(baseAmount) * 0.18, // 18% GST
          currency: 'INR',
          status: 'PAID',
          paymentDate: new Date(),
          pdfUrl: `/invoices/${invoiceNumber}.pdf`,
        },
      });

      // 4. Record SubscriptionPayment
      await tx.subscriptionPayment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: baseAmount,
          transactionId: paymentResponse.transactionId,
          gateway: paymentResponse.gateway,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });

      return updatedSub;
    });
  }
}

