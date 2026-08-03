import { Controller, Post, Get, Put, Body, UseGuards, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContext } from './tenant.context';

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
        name: 'EduTrack Application',
        subdomain: null,
        logoUrl: null,
        subtitle: 'School Management Platform',
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

  @UseGuards(JwtAuthGuard)
  @Get('setup-status')
  async getSetupStatus(@Req() req: any) {
    const tenantId = req.user.tenantId;

    const currentUser = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        staffProfile: {
          select: { id: true, staffRole: true, designation: true, staffCategory: true }
        }
      },
    });

    const setup = await this.prisma.schoolSetup.findUnique({
      where: { tenantId },
      include: { tenant: true },
    });

    if (!setup) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      return {
        setupCompleted: false,
        completionPercentage: 0,
        classesCount: 0,
        teachersCount: 0,
        studentsCount: 0,
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
          schoolName: tenant.name,
          schoolType: 'School',
          adminName: tenant.name,
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
          schoolLogo: null,
          isCompleted: false,
        } : null,
        currentUser,
      };
    }

    // Calculate profile completion percentage based on 13 total fields
    const fields = [
      setup.schoolName, setup.schoolType, setup.adminName, setup.mobileNumber,
      setup.email, setup.address, setup.academicYear, setup.principalName,
      setup.country, setup.state, setup.district, setup.city, setup.postalCode
    ];
    
    const filledCount = fields.filter(val => val && String(val).trim() !== '').length;
    const completionPercentage = Math.round((filledCount / fields.length) * 100);

    // Entity counts for setup progress metrics
    const classesCount = await this.prisma.classSection.count({
      where: {
        tenantId,
        class: {
          isActive: true,
        },
      },
    });

    const teachersCount = await this.prisma.staffProfile.count({
      where: {
        user: {
          tenantId,
          isActive: true,
          role: { in: ['TEACHER', 'STAFF'] },
        },
      },
    });

    const studentsCount = await this.prisma.studentProfile.count({
      where: {
        user: {
          tenantId,
          isActive: true,
        },
      },
    });

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

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    return {
      setupCompleted: setup.isCompleted,
      completionPercentage,
      classesCount,
      teachersCount,
      studentsCount,
      missingFields,
      setup,
      currentUser,
      subscription: subscription ? {
        plan: subscription.plan.name,
        status: subscription.status,
        expiryDate: subscription.expiryDate,
        studentLimit: subscription.plan.studentLimit,
        teacherLimit: subscription.plan.teacherLimit,
        features: subscription.plan.features,
      } : null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    const tenantId = req.user.tenantId;

    const studentsCount = await this.prisma.studentProfile.count({
      where: { user: { tenantId } },
    });

    const teachersCount = await this.prisma.staffProfile.count({
      where: { user: { tenantId } },
    });

    const classesCount = await this.prisma.class.count({
      where: { tenantId },
    });

    const booksCount = await this.prisma.book.count({
      where: { tenantId },
    });

    const complaintsCount = await this.prisma.behaviorCase.count({
      where: { tenantId },
    });

    // Invoices / revenue
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      select: { paidAmount: true },
    });
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

    // Expenses
    const expenses = await this.prisma.expense.findMany({
      where: { tenantId },
      select: { amount: true },
    });
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Attendance rate
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { tenantId },
      select: { presentCount: true, totalStudents: true },
    });
    const totalPresent = sessions.reduce((sum, s) => sum + s.presentCount, 0);
    const totalRoster = sessions.reduce((sum, s) => sum + s.totalStudents, 0);
    const attendanceRate = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 0;

    // Academic scores
    const marks = await this.prisma.examMark.findMany({
      where: { tenantId },
      select: { marksObtained: true },
    });
    const academicAverage = marks.length > 0
      ? Math.round((marks.reduce((sum, m) => sum + Number(m.marksObtained), 0) / (marks.length)) * 10) / 10
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
    const tenantId = req.user.tenantId;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        bankName: body.bankName || null,
        bankBranch: body.bankBranch || null,
        bankIFSC: body.bankIFSC || null,
        bankAccountNo: body.bankAccountNo || null,
        googlePayId: body.googlePayId || null,
        phonePeId: body.phonePeId || null,
        upiQrId: body.upiQrId || null,
      },
    });
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
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
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
}
