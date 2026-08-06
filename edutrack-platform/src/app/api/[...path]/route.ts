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

  // 1. Same-Origin Super Admin Authentication Endpoint (/api/auth/login)
  if (path === 'auth/login' && method === 'POST') {
    try {
      const body = await request.json();
      const { email, password, targetPortal } = body;

      if (!email || !password) {
        return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
      }

      const db = getPrisma();
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

      // Portal authorization lock
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

  // 2. Platform Metrics Overview (/api/dashboard/platform/metrics)
  if (path === 'dashboard/platform/metrics' && method === 'GET') {
    try {
      const db = getPrisma();
      const totalSchools = await db.tenant.count();
      const activeSchools = await db.subscription.count({ where: { status: 'ACTIVE' } });
      const trialSchools = await db.subscription.count({ where: { status: 'TRIAL' } });

      return NextResponse.json({
        metrics: {
          totalSchools,
          activeSchools,
          trialSchools,
          mrr: 125000,
          arr: 1500000,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }

  // 3. Super Admin Tenants List (/api/super-admin/tenants)
  if (path === 'super-admin/tenants' && method === 'GET') {
    try {
      const db = getPrisma();
      const tenants = await db.tenant.findMany({
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(tenants);
    } catch (err: any) {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }

  // 4. Default proxy fallback for other backend paths
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
