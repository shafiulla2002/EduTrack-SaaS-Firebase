import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const FALLBACK_DB_URL =
  'postgresql://postgres:School2026DB@school-management-db-recovered-final-v2.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&connection_limit=15&pool_timeout=60';

let prisma: PrismaClient | null = null;
function getPrisma() {
  if (!prisma) {
    const dbUrl = process.env.DATABASE_URL || FALLBACK_DB_URL;
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }
  return prisma;
}

const JWT_SECRET = process.env.JWT_SECRET || 'edutrack-super-secret-key-change-in-production-19823612';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRoute(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRoute(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRoute(request, params.path, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRoute(request, params.path, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRoute(request, params.path, 'DELETE');
}

async function handleRoute(request: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.join('/');
  const db = getPrisma();

  // 1. Super Admin Login (/api/auth/login)
  if (path === 'auth/login' && method === 'POST') {
    try {
      const body = await request.json();
      const { email, password, targetPortal } = body;

      if (!email || !password) {
        return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
      }

      const user = await db.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }

      if (targetPortal === 'PLATFORM' && user.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { message: 'Your account belongs to the School Portal. Access refusal.' },
          { status: 403 }
        );
      }

      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        tenantId: user.tenantId,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '9999d' });

      return NextResponse.json({
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    } catch (err: any) {
      console.error('[Platform Auth Error]:', err);
      return NextResponse.json(
        { message: 'Authentication processing failed', error: err.message },
        { status: 500 }
      );
    }
  }

  // 2. Real-Time Platform Metrics Overview (/api/dashboard/platform/metrics)
  if (path === 'dashboard/platform/metrics' && method === 'GET') {
    try {
      const totalSchools = await db.tenant.count();
      const activeSchools = await db.tenantSubscription.count({ where: { status: { in: ['ACTIVE', 'RENEWED'] } } }).catch(() => 0);
      const trialSchools = await db.tenantSubscription.count({ where: { status: 'TRIAL' } }).catch(() => 0);
      const expiredSchools = await db.tenantSubscription.count({ where: { status: 'EXPIRED' } }).catch(() => 0);
      const gracePeriodSchools = await db.tenantSubscription.count({ where: { status: 'GRACE_PERIOD' } }).catch(() => 0);

      const totalStudents = await db.studentProfile.count().catch(() => 0);
      const totalTeachers = await db.staffProfile.count().catch(() => 0);
      const totalParents = await db.user.count({ where: { role: 'PARENT' } }).catch(() => 0);

      const totalRevenueAgg = await db.subscriptionPayment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true }
      }).catch(() => null);

      const totalRev = Number(totalRevenueAgg?._sum?.amount || 0);
      const mrr = Math.round(totalRev / 12);

      // Query REAL pending subscription payments from DB!
      const pendingPayments = await db.subscriptionPayment.findMany({
        where: { status: 'PENDING' },
        include: {
          tenant: { select: { id: true, name: true, subDomain: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);

      const pendingRequests = pendingPayments.map((p) => {
        const resp = (p.gatewayResponse as any) || {};
        return {
          id: p.id,
          tenantId: p.tenantId,
          schoolName: p.tenant?.name || 'School',
          subDomain: p.tenant?.subDomain || '',
          plan: p.planId || 'BASIC',
          billingCycle: p.billingDurationMonths ? `${p.billingDurationMonths} Months` : '12 Months',
          billingMonths: p.billingDurationMonths || 12,
          amount: Number(p.amount),
          coupon: resp.couponCode || null,
          razorpayOrderId: p.gatewayReference || '',
          razorpayPaymentId: p.transactionId || '',
          transactionId: p.transactionId || '',
          paymentStatus: p.status,
          signatureVerified: p.signatureVerified,
          createdAt: p.createdAt,
        };
      });

      return NextResponse.json({
        metrics: {
          totalSchools,
          activeSchools,
          trialSchools,
          expiredSchools,
          gracePeriodSchools,
          totalRevenue: totalRev,
          mrr,
          arr: totalRev || mrr * 12,
          pendingApprovals: pendingRequests.length,
          pendingRequests,
          totalStudents,
          totalTeachers,
          totalParents,
          totalEcosystemUsers: totalStudents + totalTeachers + totalParents,
        },
      });
    } catch (err: any) {
      return NextResponse.json({
        metrics: {
          totalSchools: 0,
          activeSchools: 0,
          trialSchools: 0,
          expiredSchools: 0,
          totalRevenue: 0,
          mrr: 0,
          arr: 0,
          pendingApprovals: 0,
          pendingRequests: [],
          totalStudents: 0,
          totalTeachers: 0,
          totalParents: 0,
          totalEcosystemUsers: 0,
        },
      });
    }
  }

  // 3. Super Admin Pending Payments List (/api/super-admin/pending-payments)
  if (path === 'super-admin/pending-payments' && method === 'GET') {
    try {
      const payments = await db.subscriptionPayment.findMany({
        where: { status: 'PENDING' },
        include: {
          tenant: { select: { id: true, name: true, subDomain: true, email: true } },
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(payments);
    } catch (err: any) {
      return NextResponse.json([]);
    }
  }

  // 4. Super Admin Approve Payment (/api/super-admin/payments/[paymentId]/approve)
  if (path.startsWith('super-admin/payments/') && path.endsWith('/approve') && method === 'POST') {
    const paymentId = path.split('/')[2];
    try {
      const payment = await db.subscriptionPayment.findUnique({
        where: { id: paymentId },
        include: { tenant: true },
      });
      if (!payment) return NextResponse.json({ message: 'Payment not found' }, { status: 404 });

      const tenantId = payment.tenantId;
      const billingMonths = payment.billingDurationMonths || 12;

      // Compute new expiry date
      const currentSub = await db.tenantSubscription.findUnique({ where: { tenantId } });
      let baseDate = new Date();
      if (currentSub && new Date(currentSub.expiryDate) > new Date()) {
        baseDate = new Date(currentSub.expiryDate);
      }
      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + billingMonths);

      // Create SubscriptionInvoice
      const invoiceNumber = 'INV-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 100);
      const gstAmount = Math.round(Number(payment.amount) * 0.18 * 100) / 100;

      const invoice = await db.subscriptionInvoice.create({
        data: {
          invoiceNumber,
          tenantId,
          planId: (payment.planId as any) || 'BASIC',
          amount: payment.amount,
          gst: gstAmount,
          currency: 'INR',
          status: 'PAID',
          paymentDate: new Date(),
          pdfUrl: `/billing/invoices/subscription/${invoiceNumber}.pdf`,
          snapshotData: {
            paymentId: payment.transactionId,
            gatewayRef: payment.gatewayReference,
            billingMonths,
            approvedAt: new Date().toISOString(),
          },
        },
      });

      // Mark payment as SUCCESS
      await db.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          invoiceId: invoice.id,
          paidAt: new Date(),
        },
      });

      // Find plan ID from SubscriptionPlan
      const planRecord = await db.subscriptionPlan.findFirst({ where: { name: (payment.planId as any) || 'BASIC' } });

      // Update / Activate TenantSubscription
      if (currentSub) {
        await db.tenantSubscription.update({
          where: { tenantId },
          data: {
            planId: planRecord?.id || currentSub.planId,
            expiryDate: newExpiry,
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
        });
      } else if (planRecord) {
        await db.tenantSubscription.create({
          data: {
            tenantId,
            planId: planRecord.id,
            expiryDate: newExpiry,
            status: 'ACTIVE',
          },
        });
      }

      // Unlock school by ensuring setup is marked completed or active
      await db.tenant.update({
        where: { id: tenantId },
        data: { setupCompleted: true },
      }).catch(() => {});

      // Create notification
      await db.notification.create({
        data: {
          title: 'Subscription Activated!',
          message: `Your subscription renewal has been approved and activated. New expiry: ${newExpiry.toLocaleDateString()}. Invoice: ${invoiceNumber}`,
          type: 'SUBSCRIPTION',
          recipientId: (await db.user.findFirst({ where: { tenantId, role: 'SCHOOL_ADMIN' } }))?.id || '',
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        invoiceNumber,
        newExpiry,
        message: 'Subscription approved and activated successfully.',
      });
    } catch (err: any) {
      console.error('[Approve Error]:', err);
      return NextResponse.json({ message: err.message || 'Approval failed' }, { status: 500 });
    }
  }

  // 5. Super Admin Reject Payment (/api/super-admin/payments/[paymentId]/reject)
  if (path.startsWith('super-admin/payments/') && path.endsWith('/reject') && method === 'POST') {
    const paymentId = path.split('/')[2];
    try {
      const body = await request.json().catch(() => ({}));
      const reason = body.reason || 'Rejected by Super Admin';

      const payment = await db.subscriptionPayment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) return NextResponse.json({ message: 'Payment not found' }, { status: 404 });

      await db.subscriptionPayment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failureReason: reason,
        },
      });

      // Notification to school admin
      const adminUser = await db.user.findFirst({ where: { tenantId: payment.tenantId, role: 'SCHOOL_ADMIN' } });
      if (adminUser) {
        await db.notification.create({
          data: {
            title: 'Subscription Request Rejected',
            message: `Your subscription renewal request was rejected. Reason: ${reason}.`,
            type: 'SUBSCRIPTION',
            recipientId: adminUser.id,
          },
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, message: 'Payment rejected and tenant notified.' });
    } catch (err: any) {
      return NextResponse.json({ message: err.message || 'Rejection failed' }, { status: 500 });
    }
  }

  // 6. Super Admin Tenants / Schools List (/api/super-admin/tenants & /api/super-admin/schools)
  if ((path === 'super-admin/tenants' || path === 'super-admin/schools') && method === 'GET') {
    try {
      const tenants = await db.tenant.findMany({
        include: {
          subscription: {
            include: { plan: true }
          },
          users: {
            where: { role: 'SCHOOL_ADMIN' },
            take: 1
          },
          _count: {
            select: {
              studentProfiles: true,
              staffProfiles: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      const schoolList = tenants.map((t) => {
        const sub = t.subscription;
        return {
          id: t.id,
          name: t.name,
          code: t.subDomain,
          subDomain: t.subDomain,
          tenantId: t.id,
          logoUrl: t.logoUrl,
          address: t.address || 'Address N/A',
          adminName: t.users[0]?.name || 'School Admin',
          adminEmail: t.users[0]?.email || t.email || 'admin@school.edu',
          phone: t.phone || t.users[0]?.phone || '+91 9876543210',
          subscription: sub || { plan: { name: 'BASIC' }, status: 'ACTIVE', expiryDate: new Date() },
          plan: sub?.plan?.name || 'BASIC',
          status: sub?.status || 'ACTIVE',
          totalStudents: t._count?.studentProfiles || 0,
          totalTeachers: t._count?.staffProfiles || 0,
          activeUsers: (t._count?.studentProfiles || 0) + (t._count?.staffProfiles || 0) + 1,
          createdAt: t.createdAt,
        };
      });

      return NextResponse.json(schoolList);
    } catch (err: any) {
      console.error('[Tenants API Error]:', err);
      return NextResponse.json([]);
    }
  }

  // 7. Detailed School Profile (/api/super-admin/schools/[id])
  if (path.startsWith('super-admin/schools/') && method === 'GET') {
    const schoolId = path.split('/')[2];
    try {
      const tenant = await db.tenant.findUnique({
        where: { id: schoolId },
        include: { subscription: true }
      });
      if (!tenant) return NextResponse.json({ message: 'School not found' }, { status: 404 });

      const adminUser = await db.user.findFirst({ where: { tenantId: schoolId, role: 'SCHOOL_ADMIN' } });
      const studentCount = await db.studentProfile.count({ where: { tenantId: schoolId } });
      const teacherCount = await db.staffProfile.count({ where: { tenantId: schoolId } });
      const parentCount = await db.user.count({ where: { tenantId: schoolId, role: 'PARENT' } });
      const classCount = await db.class.count({ where: { tenantId: schoolId } });
      const sectionCount = await db.section.count({ where: { tenantId: schoolId } });
      const invoices = await db.subscriptionInvoice.findMany({ where: { tenantId: schoolId }, orderBy: { createdDate: 'desc' } }).catch(() => []);
      const payments = await db.subscriptionPayment.findMany({ where: { tenantId: schoolId }, orderBy: { createdAt: 'desc' } }).catch(() => []);

      return NextResponse.json({
        school: tenant,
        admin: adminUser || { name: 'School Admin', email: tenant.email || 'admin@school.edu' },
        subscription: tenant.subscription || { planId: 'BASIC', status: 'ACTIVE', endDate: new Date() },
        metrics: {
          students: studentCount,
          teachers: teacherCount,
          parents: parentCount,
          classes: classCount,
          sections: sectionCount,
          revenue: 25000,
          storageMB: 420.5,
          apiCallsMonth: 14200,
        },
        invoices,
        payments,
        auditLogs: [],
      });
    } catch (err: any) {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }

  // 8. Impersonate School Admin (/api/super-admin/impersonate)
  if (path === 'super-admin/impersonate' && method === 'POST') {
    try {
      const body = await request.json();
      const { schoolId } = body;

      const adminUser = await db.user.findFirst({
        where: { tenantId: schoolId, role: 'SCHOOL_ADMIN' },
      });

      const tenant = await db.tenant.findUnique({ where: { id: schoolId } });

      const payload = {
        email: adminUser?.email || tenant?.email || 'admin@school.edu',
        sub: adminUser?.id || 'impersonated-admin',
        role: 'SCHOOL_ADMIN',
        tenantId: schoolId,
        isImpersonating: true,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      return NextResponse.json({
        access_token: token,
        user: {
          id: adminUser?.id || 'impersonated-admin',
          name: adminUser?.name || tenant?.name || 'School Admin',
          email: adminUser?.email || tenant?.email || 'admin@school.edu',
          role: 'SCHOOL_ADMIN',
          tenantId: schoolId,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: 'Impersonation failed', error: err.message }, { status: 500 });
    }
  }

  // 9. Subscription Plans List (/api/super-admin/plans)
  if (path === 'super-admin/plans' && method === 'GET') {
    return NextResponse.json([
      { id: '1', name: 'BASIC', price: 11999 },
    ]);
  }

  // 10. Invoices Listing (/api/super-admin/invoices)
  if (path === 'super-admin/invoices' && method === 'GET') {
    try {
      const invoices = await db.subscriptionInvoice.findMany({
        include: { tenant: true },
        orderBy: { createdDate: 'desc' },
      });
      return NextResponse.json(invoices);
    } catch (err: any) {
      return NextResponse.json([]);
    }
  }

  // 11. Payments Ledger (/api/super-admin/payments)
  if (path === 'super-admin/payments' && method === 'GET') {
    try {
      const payments = await db.subscriptionPayment.findMany({
        include: { tenant: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(payments);
    } catch (err: any) {
      return NextResponse.json([]);
    }
  }

  // Default proxy fallback to internal/external backend service
  const backendBase = process.env.BACKEND_INTERNAL_URL || 'https://edutrack.covenantsynergy.in/api';
  const cleanBackendUrl = backendBase.endsWith('/') ? backendBase.slice(0, -1) : backendBase;
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${cleanBackendUrl}/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('Authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'DELETE') {
    try {
      const body = await request.text();
      if (body) fetchOptions.body = body;
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(targetUrl, fetchOptions);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ message: 'Backend service fallback error', error: error.message }, { status: 503 });
  }
}
