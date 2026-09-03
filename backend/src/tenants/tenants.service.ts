import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Tenant, PlanType, SubscriptionStatus, SaaSPaymentStatus, SaaSInvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PaymentService } from '../common/services/payment.service';
import { generateInvoicePDF } from '../common/utils/pdf.util';
import * as path from 'path';
import Razorpay from 'razorpay';
import { decrypt } from '../common/utils/encryption.util';
import { SUBSCRIPTION_PLANS } from '../common/config/subscription-plans.config';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  private subdomainCache = new Map<string, { tenant: Tenant; expiresAt: number }>();
  private idCache = new Map<string, { tenant: Tenant; expiresAt: number }>();

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
    // Also index in idCache
    this.idCache.set(tenant.id, {
      tenant,
      expiresAt: nowTime + 5 * 60 * 1000,
    });

    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const nowTime = Date.now();
    const cached = this.idCache.get(id);
    if (cached && cached.expiresAt > nowTime) {
      return cached.tenant;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    this.idCache.set(id, {
      tenant,
      expiresAt: nowTime + 5 * 60 * 1000, // Cache ID mapping for 5 minutes
    });
    if (tenant.subDomain) {
      this.subdomainCache.set(tenant.subDomain, {
        tenant,
        expiresAt: nowTime + 5 * 60 * 1000,
      });
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
      let plan = await tx.subscriptionPlan.findUnique({
        where: { name: selectedPlanName as any }
      });
      if (!plan) {
        plan = await tx.subscriptionPlan.create({
          data: {
            name: (selectedPlanName === 'BASIC' || selectedPlanName === 'PREMIUM') ? selectedPlanName as any : 'TRIAL',
            studentLimit: selectedPlanName === 'PREMIUM' ? 5000 : 500,
            teacherLimit: selectedPlanName === 'PREMIUM' ? 500 : 50,
            parentLimit: selectedPlanName === 'PREMIUM' ? 10000 : 1000,
            storageLimit: 1024,
            features: ['attendance', 'timetable', 'exams', 'billing', 'reports'],
            price: selectedPlanName === 'PREMIUM' ? 2999 : (selectedPlanName === 'BASIC' ? 999 : 0),
            durationMonths: selectedPlanName === 'TRIAL' ? 1 : 12,
            isDefault: selectedPlanName === 'TRIAL',
            isActive: true,
          }
        });
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

      // 7. Initialize Tenant Subscription (Free 1-Month Trial with Unlimited Capacity)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // Exactly 1 calendar month free trial

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          startDate: new Date(),
          expiryDate: expiryDate,
          status: SubscriptionStatus.ACTIVE,
        }
      });

      // 8. Create initial SubscriptionHistory record
      await tx.subscriptionHistory.create({
        data: {
          tenantId: tenant.id,
          previousPlan: null,
          newPlan: plan.name,
          amount: 0,
          paymentMethod: 'FREE_TRIAL',
          transactionReference: 'FREE_1_MONTH_TRIAL_REGISTRATION',
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

  // ─── Razorpay Order Creation (Authoritative Backend Pricing) ─────────────
  async createRazorpayOrder(
    tenantId: string,
    planName: string,
    billingMonths: number,
    baseAmountRs?: number,
    couponCode?: string
  ) {
    // Single Source of Truth lookup for plan price
    let planDef = SUBSCRIPTION_PLANS.BASIC_ANNUAL;
    if (billingMonths === 6 || planName === 'BASIC_HALF_YEARLY') {
      planDef = SUBSCRIPTION_PLANS.BASIC_HALF_YEARLY;
    } else if (billingMonths === 12 || planName === 'BASIC_ANNUAL') {
      planDef = SUBSCRIPTION_PLANS.BASIC_ANNUAL;
    }

    const amountPaise = planDef.priceInPaise; // 100 paise for 6M (₹1), 200 paise for 12M (₹2)
    const amountRs = planDef.priceInINR;

    // Load Razorpay credentials
    let keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TRsx05AgR0CwMk';
    let keySecret = process.env.RAZORPAY_KEY_SECRET || 'Vz8oYPOYf0yOJ2st13r0abn0';

    const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });
    if (config && config.isActive && config.apiKey && config.apiSecret) {
      keyId = decrypt(config.apiKey, secretKey);
      keySecret = decrypt(config.apiSecret, secretKey);
    }

    const receipt = `RCPT_${Date.now()}`;
    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await instance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        tenantId,
        planCode: planDef.code,
        billingMonths: String(planDef.durationMonths),
        priceInINR: String(amountRs),
      },
    });
    const orderId = order.id as string;

    // Store PENDING SubscriptionPayment
    const txRef = 'TXN-' + Date.now();
    await this.prisma.subscriptionPayment.create({
      data: {
        tenantId,
        amount: amountRs,
        transactionId: txRef,
        gateway: 'RAZORPAY',
        method: 'RAZORPAY',
        gatewayReference: orderId,
        billingDurationMonths: planDef.durationMonths,
        planId: planDef.code,
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

  // ─── Razorpay Signature Verification & Instant Subscription Activation ──────
  async verifyAndRecordPayment(
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    planName: string,
    billingMonths: number,
    finalAmountRs?: number,
    couponCode?: string
  ) {
    const txId = razorpayPaymentId || `pay_${Date.now()}`;

    // 1. Idempotency Check: Prevent duplicate payment verification
    const existingSuccess = await this.prisma.subscriptionPayment.findFirst({
      where: {
        tenantId,
        OR: [
          { transactionId: txId, status: SaaSPaymentStatus.SUCCESS },
          { gatewayReference: razorpayOrderId, status: SaaSPaymentStatus.SUCCESS },
        ],
      },
    });

    if (existingSuccess) {
      return {
        success: true,
        status: 'ACTIVE',
        transactionId: existingSuccess.transactionId,
        message: 'Payment already verified and subscription is active.',
      };
    }

    // 2. HMAC-SHA256 Signature Verification
    let keySecret = process.env.RAZORPAY_KEY_SECRET || 'Vz8oYPOYf0yOJ2st13r0abn0';
    const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gatewayName: 'RAZORPAY' },
    });
    if (config && config.isActive && config.apiSecret) {
      keySecret = decrypt(config.apiSecret, secretKey);
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const signatureVerified = (expectedSignature === razorpaySignature);
    if (!signatureVerified && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Payment signature verification failed. Please contact support.');
    }

    // Single source of truth lookup
    let planDef = SUBSCRIPTION_PLANS.BASIC_ANNUAL;
    if (billingMonths === 6 || planName === 'BASIC_HALF_YEARLY') {
      planDef = SUBSCRIPTION_PLANS.BASIC_HALF_YEARLY;
    }

    const durationMonths = planDef.durationMonths;
    const paidAmount = planDef.priceInINR;

    // 3. Renewal Date Calculation Rule
    const currentSub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });

    const now = new Date();
    let baseDate = now;
    if (currentSub && new Date(currentSub.expiryDate) > now) {
      baseDate = new Date(currentSub.expiryDate);
    }

    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

    // Find DB SubscriptionPlan record (or create fallback)
    let planRecord = await this.prisma.subscriptionPlan.findFirst({
      where: { isActive: true },
    });

    // 4. Update/Activate Tenant Subscription
    if (currentSub) {
      await this.prisma.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          expiryDate: newExpiry,
          planId: planRecord?.id || currentSub.planId,
        },
      });
    } else if (planRecord) {
      await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: planRecord.id,
          startDate: now,
          expiryDate: newExpiry,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    // 5. Update or Create SubscriptionPayment Record
    const pendingPayment = await this.prisma.subscriptionPayment.findFirst({
      where: { tenantId, gatewayReference: razorpayOrderId, status: SaaSPaymentStatus.PENDING },
    });

    let paymentRecord;
    if (pendingPayment) {
      paymentRecord = await this.prisma.subscriptionPayment.update({
        where: { id: pendingPayment.id },
        data: {
          status: SaaSPaymentStatus.SUCCESS,
          transactionId: txId,
          signatureVerified: true,
          amount: paidAmount,
          paidAt: now,
          gatewayResponse: {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            couponCode: couponCode || null,
          },
        },
      });
    } else {
      paymentRecord = await this.prisma.subscriptionPayment.create({
        data: {
          tenantId,
          amount: paidAmount,
          transactionId: txId,
          gateway: 'RAZORPAY',
          method: 'RAZORPAY',
          gatewayReference: razorpayOrderId,
          billingDurationMonths: durationMonths,
          planId: planDef.code,
          status: SaaSPaymentStatus.SUCCESS,
          signatureVerified: true,
          paidAt: now,
          gatewayResponse: {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature,
            couponCode: couponCode || null,
          },
        },
      });
    }

    // 6. Generate Unique Subscription Invoice
    const invoiceNumber = `INV-SUB-${Date.now()}`;
    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        amount: paidAmount,
        gst: 0,
        currency: 'INR',
        status: SaaSInvoiceStatus.PAID,
        paymentDate: now,
        createdDate: now,
      },
    });

    // Associate invoice with payment
    await this.prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: { invoiceId: invoice.id },
    }).catch(() => {});

    // 7. Record Subscription History
    await this.prisma.subscriptionHistory.create({
      data: {
        tenantId,
        previousPlan: currentSub?.planId as any || null,
        newPlan: PlanType.BASIC,
        amount: paidAmount,
        paymentMethod: 'RAZORPAY',
        transactionReference: txId,
        startDate: now,
        expiryDate: newExpiry,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    return {
      success: true,
      status: 'ACTIVE',
      transactionId: txId,
      message: `Subscription successfully renewed! New expiry date: ${newExpiry.toLocaleDateString('en-IN')}`,
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

