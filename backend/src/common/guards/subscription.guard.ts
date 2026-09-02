import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let user = request.user;

    // Decode JWT token manually if auth guard hasn't populated request.user yet
    if (!user) {
      const authHeader = request.headers.authorization || request.headers.Authorization;
      if (authHeader && String(authHeader).startsWith('Bearer ')) {
        const token = String(authHeader).substring(7);
        try {
          user = this.jwtService.verify(token);
          request.user = user;
        } catch (e) {
          // Token invalid/expired, let JwtAuthGuard handle it
        }
      }
    }

    const path = String(request.path || request.url || '');
    const method = String(request.method || 'GET').toUpperCase();

    // 1. NON-BLOCKING AUTH EXEMPTIONS: Authentication, registration, logout, branding, setup-status, support, health
    const isAuthPath =
      path.includes('/auth/') ||
      path.includes('/login') ||
      path.includes('/send-otp') ||
      path.includes('/verify-otp') ||
      path.includes('/exchange-code') ||
      path.includes('/password-reset') ||
      path.includes('/logout') ||
      path.includes('/tenant/register') ||
      path.includes('/tenant/setup-status') ||
      path.includes('/tenant/public-branding') ||
      path.includes('/support') ||
      path.includes('/super-admin') ||
      path.includes('/health') ||
      path.includes('/ready');

    if (isAuthPath) {
      return true;
    }

    // 2. If no authenticated user or tenantId, bypass (let JwtAuthGuard block unauthenticated requests)
    if (!user || !user.tenantId) {
      return true;
    }

    // 3. Admin Renewal Route Exemptions: Allow SCHOOL_ADMIN / ADMIN to call subscription plans, create-order, verify-payment
    const isSubscriptionRenewalPath = path.includes('/tenant/subscription');
    const isAdmin = user.role === 'SCHOOL_ADMIN' || user.role === 'ADMIN';

    if (isSubscriptionRenewalPath) {
      if (isAdmin) {
        return true;
      } else {
        // Teachers / Parents cannot invoke admin subscription renewal routes
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Only school administrators can access subscription renewal options.',
        });
      }
    }

    // 4. Fetch Tenant Subscription
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!sub) {
      return true; // If no subscription record, allow navigation
    }

    const now = new Date();
    const expiryDate = new Date(sub.expiryDate);

    // 5. Expiry Check
    if (now > expiryDate) {
      // Sync EXPIRED status to DB if not set
      if (sub.status !== SubscriptionStatus.EXPIRED) {
        await this.prisma.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        }).catch(() => {});
      }

      // ─── ADMIN PORTAL POST-EXPIRY (Read-Only Mode) ───
      if (isAdmin) {
        // GET requests: ALLOWED (Read-Only access to inspect dashboard, reports, data)
        if (method === 'GET') {
          const response = context.switchToHttp().getResponse();
          if (response && typeof response.setHeader === 'function') {
            response.setHeader('X-Subscription-Status', 'EXPIRED');
            response.setHeader('X-Subscription-Mode', 'READ_ONLY');
          }
          return true;
        }

        // Data-changing requests (POST, PUT, PATCH, DELETE): BLOCKED
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_EXPIRED',
          message: "Your school's EduTrack subscription has expired. The application is in read-only mode. Please renew your subscription to restore full access.",
        });
      }

      // ─── TEACHER & PARENT PORTALS POST-EXPIRY (Locked Mode) ───
      if (['TEACHER', 'STAFF', 'PARENT', 'STUDENT'].includes(user.role)) {
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_EXPIRED',
          message: "Your school's EduTrack subscription has expired. Please reach out to your school admin.",
        });
      }
    } else {
      // Expiry is in future: ensure status is ACTIVE
      if (sub.status !== SubscriptionStatus.ACTIVE) {
        await this.prisma.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.ACTIVE },
        }).catch(() => {});
      }
    }

    return true;
  }
}
