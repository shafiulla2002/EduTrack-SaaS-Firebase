import { Controller, Post, Get, Put, Body, UseGuards, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContext } from './tenant.context';
import { encrypt, decrypt } from '../common/utils/encryption.util';

@Controller('tenant')
export class TenantController {
  constructor(
    private tenantsService: TenantsService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Get('public-branding')
  async getPublicBranding(@Req() req: any) {
    const tenantId = req['tenantId'];

    // No tenant resolved (root domain, no subdomain) → return generic platform branding
    if (!tenantId) {
      return {
        id: null,
        name: 'CS EduTrack',
        subdomain: null,
        logoUrl: null,
        subtitle: 'Smarter Institute Management',
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const setup = await this.prisma.schoolSetup.findUnique({
      where: { tenantId }
    });

    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subDomain,
      logoUrl: setup?.schoolLogo || tenant.logoUrl || null,
      subtitle: tenant.subtitle || setup?.schoolType || 'Building Excellence for Futures'
    };
  }

  @Post('register')
  async register(@Body() body: any) {
    const required = [
      'schoolName',
      'schoolType',
      'adminName',
      'mobileNumber',
      'email',
      'address',
      'academicYear',
    ];

    for (const field of required) {
      if (!body[field] || String(body[field]).trim() === '') {
        throw new BadRequestException(`Field '${field}' is required for school registration`);
      }
    }

    // Register tenant and user
    const result = await this.tenantsService.registerTenant(body);

    // Automatically log in the user and return their session JWT token
    const loginResult = await this.authService.login(result.user);

    return {
      success: true,
      message: 'School registered successfully',
      ...loginResult,
    };
  }

  private static setupStatusCache = new Map<string, { data: any; expiresAt: number }>();

  public static invalidateCache(tenantId?: string) {
    if (tenantId) {
      this.setupStatusCache.forEach((_, key) => {
        if (key.startsWith(`${tenantId}:`)) {
          this.setupStatusCache.delete(key);
        }
      });
    } else {
      this.setupStatusCache.clear();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('setup-status')
  async getSetupStatus(@Req() req: any) {
    if (!req.user || !req.user.id) {
      return {
        setupCompleted: false,
        completionPercentage: 0,
        classesCount: 0,
        teachersCount: 0,
        studentsCount: 0,
        setup: null,
        currentUser: null,
        subscription: null,
      };
    }

    const tenantId = req.user.tenantId;

    if (!tenantId) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          staffProfile: {
            select: { id: true, staffRole: true, designation: true, staffCategory: true }
          }
        },
      });

      return {
        setupCompleted: false,
        completionPercentage: 0,
        classesCount: 0,
        teachersCount: 0,
        studentsCount: 0,
        setup: null,
        currentUser,
        subscription: null,
      };
    }

    const cacheKey = `${tenantId}:${req.user.id}`;
    const cached = TenantController.setupStatusCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const [
        currentUser,
        setup,
        classesCount,
        teachersCount,
        studentsCount,
        subscription
      ] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            staffProfile: {
              select: { id: true, staffRole: true, designation: true, staffCategory: true }
            }
          },
        }),
        this.prisma.schoolSetup.findUnique({
          where: { tenantId },
          include: { tenant: true },
        }),
        this.prisma.classSection.count({
          where: {
            tenantId,
            class: {
              isActive: true,
            },
          },
        }),
        this.prisma.staffProfile.count({
          where: {
            user: {
              tenantId,
              isActive: true,
              role: { in: ['TEACHER', 'STAFF'] },
            },
          },
        }),
        this.prisma.studentProfile.count({
          where: {
            user: {
              tenantId,
              isActive: true,
            },
          },
        }),
        this.prisma.tenantSubscription.findUnique({
          where: { tenantId },
          include: { plan: true },
        })
      ]);

      if (!setup) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        const incompleteResult = {
          setupCompleted: false,
          completionPercentage: 0,
          classesCount: classesCount || 0,
          teachersCount: teachersCount || 0,
          studentsCount: studentsCount || 0,
          missingFields: [
            'schoolName',
            'schoolType',
            'adminName',
            'mobileNumber',
            'email',
            'address',
            'academicYear',
          ],
          setup: tenant ? {
            id: '',
            tenantId: tenant.id,
            schoolName: tenant.name || '',
            schoolType: tenant.subtitle || 'School',
            adminName: currentUser?.name || tenant.name || 'Admin',
            mobileNumber: tenant.phone || '',
            email: tenant.email || '',
            address: tenant.address || '',
            academicYear: '2026-2027',
            principalName: '',
            country: '',
            state: '',
            district: '',
            city: '',
            postalCode: '',
            schoolLogo: tenant.logoUrl || null,
            isCompleted: false,
          } : null,
          tenantName: tenant?.name || '',
          tenantLogo: tenant?.logoUrl || null,
          currentUser,
          subscription: subscription ? {
            plan: subscription.plan?.name || 'TRIAL',
            status: subscription.status,
            expiryDate: subscription.expiryDate,
            studentLimit: subscription.plan?.studentLimit || 500,
            teacherLimit: subscription.plan?.teacherLimit || 50,
            features: subscription.plan?.features || [],
          } : null,
        };

        TenantController.setupStatusCache.set(cacheKey, {
          data: incompleteResult,
          expiresAt: Date.now() + 60000 // 60s in-memory TTL
        });

        return incompleteResult;
      }

      // Ensure fallback to tenant/currentUser names if empty in setup
      if (!setup.schoolName && setup.tenant?.name) {
        setup.schoolName = setup.tenant.name;
      }
      if (!setup.adminName && currentUser?.name) {
        setup.adminName = currentUser.name;
      }
      if (!setup.schoolLogo && setup.tenant?.logoUrl) {
        setup.schoolLogo = setup.tenant.logoUrl;
      }

      // Calculate profile completion percentage based on 13 total fields
      const fields = [
        setup.schoolName, setup.schoolType, setup.adminName, setup.mobileNumber,
        setup.email, setup.address, setup.academicYear, setup.principalName,
        setup.country, setup.state, setup.district, setup.city, setup.postalCode
      ];
      
      const filledCount = fields.filter(val => val && String(val).trim() !== '').length;
      const completionPercentage = Math.round((filledCount / fields.length) * 100);

      // Identify missing optional setup fields
      const missingFields: string[] = [];
      const checkFields = {
        principalName: setup.principalName,
        country: setup.country,
        state: setup.state,
        district: setup.district,
        city: setup.city,
        postalCode: setup.postalCode,
        schoolLogo: setup.schoolLogo,
      };

      for (const [key, val] of Object.entries(checkFields)) {
        if (!val || String(val).trim() === '') {
          missingFields.push(key);
        }
      }

      // Sanitize tenant Razorpay secrets before returning to client
      if (setup && setup.tenant) {
        const sanitizedTenant = { ...setup.tenant } as any;
        sanitizedTenant.hasRazorpayKeySecret = !!setup.tenant.razorpayKeySecret;
        sanitizedTenant.hasRazorpayWebhookSecret = !!setup.tenant.razorpayWebhookSecret;
        delete sanitizedTenant.razorpayKeySecret;
        delete sanitizedTenant.razorpayWebhookSecret;
        setup.tenant = sanitizedTenant;
      }

      const statusResult = {
        setupCompleted: setup.isCompleted,
        completionPercentage,
        classesCount: classesCount || 0,
        teachersCount: teachersCount || 0,
        studentsCount: studentsCount || 0,
        missingFields,
        setup,
        tenantName: setup.schoolName || setup.tenant?.name || '',
        tenantLogo: setup.schoolLogo || setup.tenant?.logoUrl || null,
        currentUser,
        subscription: subscription ? {
          plan: subscription.plan?.name || 'TRIAL',
          status: subscription.status,
          expiryDate: subscription.expiryDate,
          studentLimit: subscription.plan?.studentLimit || 500,
          teacherLimit: subscription.plan?.teacherLimit || 50,
          features: subscription.plan?.features || [],
        } : null,
      };

      TenantController.setupStatusCache.set(cacheKey, {
        data: statusResult,
        expiresAt: Date.now() + 60000 // 60s in-memory TTL
      });

      return statusResult;
    } catch (err) {
      console.warn('[TenantController] Error in getSetupStatus, returning safe fallback:', err);
      return {
        setupCompleted: false,
        completionPercentage: 0,
        classesCount: 0,
        teachersCount: 0,
        studentsCount: 0,
        setup: null,
        currentUser: null,
        subscription: null,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('razorpay-config')
  async getRazorpayConfig(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant not identified in session.');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        razorpayEnabled: true,
        razorpayIsTestMode: true,
        razorpayKeyId: true,
        razorpayKeySecret: true,
        razorpayWebhookSecret: true,
      },
    });

    if (!tenant) throw new NotFoundException('School tenant not found.');

    return {
      enabled: !!tenant.razorpayEnabled,
      isTestMode: tenant.razorpayIsTestMode ?? true,
      keyId: tenant.razorpayKeyId || '',
      hasKeySecret: !!tenant.razorpayKeySecret,
      hasWebhookSecret: !!tenant.razorpayWebhookSecret,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('razorpay-config')
  async updateRazorpayConfig(@Req() req: any, @Body() body: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant not identified in session.');

    const userRole = req.user?.role;
    if (userRole !== 'SCHOOL_ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new BadRequestException('Unauthorized: Only school administrators can update payment gateway configuration.');
    }

    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!existing) throw new NotFoundException('School tenant not found.');

    const enabled = typeof body.enabled === 'boolean' ? body.enabled : existing.razorpayEnabled;
    const isTestMode = typeof body.isTestMode === 'boolean' ? body.isTestMode : (existing.razorpayIsTestMode ?? true);
    const keyId = body.keyId !== undefined ? String(body.keyId).trim() : existing.razorpayKeyId;

    if (enabled) {
      if (!keyId) {
        throw new BadRequestException('Razorpay Key ID is required when enabling the gateway.');
      }
      if (isTestMode && !keyId.startsWith('rzp_test_')) {
        throw new BadRequestException('Invalid Key ID for Test Mode: Key ID must start with "rzp_test_".');
      }
      if (!isTestMode && !keyId.startsWith('rzp_live_')) {
        throw new BadRequestException('Invalid Key ID for Live Mode: Key ID must start with "rzp_live_".');
      }
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'edutrack_saas_secure_encryption_key_32_bytes_!';

    let encryptedSecret = existing.razorpayKeySecret;
    if (body.keySecret && String(body.keySecret).trim() && !String(body.keySecret).includes('•••')) {
      encryptedSecret = encrypt(String(body.keySecret).trim(), encryptionKey);
    }

    if (enabled && !encryptedSecret) {
      throw new BadRequestException('Razorpay Key Secret is required when enabling the gateway.');
    }

    let encryptedWebhookSecret = existing.razorpayWebhookSecret;
    if (body.webhookSecret !== undefined) {
      const cleanWebhook = String(body.webhookSecret).trim();
      if (!cleanWebhook) {
        encryptedWebhookSecret = null;
      } else if (!cleanWebhook.includes('•••')) {
        encryptedWebhookSecret = encrypt(cleanWebhook, encryptionKey);
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        razorpayEnabled: enabled,
        razorpayIsTestMode: isTestMode,
        razorpayKeyId: keyId || null,
        razorpayKeySecret: encryptedSecret,
        razorpayWebhookSecret: encryptedWebhookSecret,
      },
    });

    TenantController.setupStatusCache.clear();

    return {
      success: true,
      message: 'School Razorpay configuration saved securely.',
      enabled,
      isTestMode,
      keyId: keyId || '',
      hasKeySecret: !!encryptedSecret,
      hasWebhookSecret: !!encryptedWebhookSecret,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    const tenantId = req.user.tenantId;

    const [
      studentsCount,
      teachersCount,
      classesCount,
      booksCount,
      complaintsCount,
      revenueAgg,
      expenseAgg,
      attendanceAgg,
      academicAgg
    ] = await Promise.all([
      this.prisma.studentProfile.count({
        where: { user: { tenantId } },
      }),
      this.prisma.staffProfile.count({
        where: { user: { tenantId } },
      }),
      this.prisma.class.count({
        where: { tenantId },
      }),
      this.prisma.book.count({
        where: { tenantId },
      }),
      this.prisma.behaviorCase.count({
        where: { tenantId },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { paidAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      }),
      this.prisma.attendanceSession.aggregate({
        where: { tenantId },
        _sum: { presentCount: true, totalStudents: true },
      }),
      this.prisma.examMark.aggregate({
        where: { tenantId },
        _avg: { marksObtained: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.paidAmount || 0);
    const totalExpenses = Number(expenseAgg._sum.amount || 0);

    const totalPresent = attendanceAgg._sum.presentCount || 0;
    const totalRoster = attendanceAgg._sum.totalStudents || 0;
    const attendanceRate = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 0;

    const academicAverage = academicAgg._avg.marksObtained
      ? Math.round(Number(academicAgg._avg.marksObtained) * 10) / 10
      : 0;

    return {
      studentsCount,
      teachersCount,
      classesCount,
      booksCount,
      complaintsCount,
      totalRevenue,
      totalExpenses,
      attendanceRate,
      academicAverage,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('banking-upi')
  async updateBankingUpi(@Req() req: any, @Body() body: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant not identified in session.');

    const dataToUpdate: any = {};
    if (body.bankName !== undefined) dataToUpdate.bankName = body.bankName ? String(body.bankName).trim() : null;
    if (body.bankBranch !== undefined) dataToUpdate.bankBranch = body.bankBranch ? String(body.bankBranch).trim() : null;
    if (body.bankIFSC !== undefined) dataToUpdate.bankIFSC = body.bankIFSC ? String(body.bankIFSC).trim().toUpperCase() : null;
    if (body.bankAccountNo !== undefined) dataToUpdate.bankAccountNo = body.bankAccountNo ? String(body.bankAccountNo).trim() : null;
    if (body.googlePayId !== undefined) dataToUpdate.googlePayId = body.googlePayId ? String(body.googlePayId).trim() : null;
    if (body.phonePeId !== undefined) dataToUpdate.phonePeId = body.phonePeId ? String(body.phonePeId).trim() : null;
    if (body.upiQrId !== undefined) dataToUpdate.upiQrId = body.upiQrId ? String(body.upiQrId).trim() : null;

    // Support Razorpay configuration updates via banking-upi
    if (body.razorpayEnabled !== undefined || body.enabled !== undefined) {
      dataToUpdate.razorpayEnabled = Boolean(body.razorpayEnabled ?? body.enabled);
    }
    if (body.razorpayIsTestMode !== undefined || body.isTestMode !== undefined) {
      dataToUpdate.razorpayIsTestMode = Boolean(body.razorpayIsTestMode ?? body.isTestMode);
    }
    if (body.razorpayKeyId !== undefined || body.keyId !== undefined) {
      const kId = body.razorpayKeyId ?? body.keyId;
      dataToUpdate.razorpayKeyId = kId ? String(kId).trim() : null;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'edutrack_saas_secure_encryption_key_32_bytes_!';
    const rawSecret = body.razorpayKeySecret || body.keySecret;
    if (rawSecret && !String(rawSecret).includes('•••')) {
      dataToUpdate.razorpayKeySecret = encrypt(String(rawSecret).trim(), encryptionKey);
    }
    const rawWebhook = body.razorpayWebhookSecret || body.webhookSecret;
    if (rawWebhook && !String(rawWebhook).includes('•••')) {
      dataToUpdate.razorpayWebhookSecret = encrypt(String(rawWebhook).trim(), encryptionKey);
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: dataToUpdate,
    });

    TenantController.setupStatusCache.clear();

    return {
      success: true,
      message: 'Payment gateway settings updated successfully.',
      hasKeySecret: !!updated.razorpayKeySecret,
      hasWebhookSecret: !!updated.razorpayWebhookSecret,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.getSubscriptionStatus(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription/plans')
  async getPlans() {
    const { SUBSCRIPTION_PLANS } = await import('../common/config/subscription-plans.config');
    return Object.values(SUBSCRIPTION_PLANS);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/renew')
  async renewSubscription(
    @Req() req: any,
    @Body('planName') planName: string,
    @Body('paymentDetails') paymentDetails: any
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    return this.tenantsService.upgradeOrRenewSubscription(tenantId, planName as any, paymentDetails, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/create-order')
  async createRazorpayOrder(
    @Req() req: any,
    @Body('planName') planName: string,
    @Body('billingMonths') billingMonths: number,
    @Body('baseAmountRs') baseAmountRs: number,
    @Body('couponCode') couponCode?: string,
  ) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.createRazorpayOrder(tenantId, planName, billingMonths, baseAmountRs, couponCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/verify-payment')
  async verifyPayment(
    @Req() req: any,
    @Body('razorpay_order_id') razorpayOrderId: string,
    @Body('razorpay_payment_id') razorpayPaymentId: string,
    @Body('razorpay_signature') razorpaySignature: string,
    @Body('planName') planName: string,
    @Body('billingMonths') billingMonths: number,
    @Body('finalAmountRs') finalAmountRs: number,
    @Body('couponCode') couponCode?: string,
  ) {
    const tenantId = req.user.tenantId;
    return this.tenantsService.verifyAndRecordPayment(
      tenantId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      planName,
      billingMonths,
      finalAmountRs,
      couponCode,
    );
  }
}
