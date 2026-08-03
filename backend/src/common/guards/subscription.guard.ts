import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { PLAN_FEATURES } from '../config/subscription.config';
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
          // Token is invalid/expired, let JwtAuthGuard handle it
        }
      }
    }

    // 1. If route is public or auth check failed earlier, bypass subscription guard
    if (!user || !user.tenantId) {
      return true;
    }

    // 2. Fetch active subscription for the user's specific tenant
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });

    if (!sub) {
      throw new HttpException(
        {
          error: 'no_subscription',
          message: 'No subscription found for this school tenant.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const now = new Date();
    const expiryDate = new Date(sub.expiryDate);

    // Exempt paths: Auth profiles, Logout, Setup/Branding views, and Subscription controllers
    const path = request.path;
    const isExemptPath =
      path.startsWith('/auth/') ||
      path.startsWith('/tenant/subscription') ||
      path.startsWith('/tenant/setup-status') ||
      path.startsWith('/tenant/public-branding');

    // 3. Expiry and Grace Period validation
    if (now > expiryDate) {
      const gracePeriodEnd = new Date(expiryDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3); // 3-Day grace period

      if (now <= gracePeriodEnd) {
        // Within 3-day Grace Period: Allow operations but inject warning header
        const response = context.switchToHttp().getResponse();
        if (response && typeof response.setHeader === 'function') {
          response.setHeader('X-Subscription-State', 'GRACE_PERIOD');
        }

        // Sync state to DB if not already done
        if (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.PAST_DUE) {
          await this.prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.PAST_DUE },
          }).catch(() => {});
        }
      } else {
        // Post Grace Period: Locked / Read-Only Mode
        if (sub.status !== SubscriptionStatus.EXPIRED) {
          await this.prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          }).catch(() => {});
        }

        if (isExemptPath) {
          return true;
        }

        // Role-based Lock Enforcement
        if (user.role === 'SCHOOL_ADMIN') {
          // Admins can only view Billing / Invoices / Profile / Logout
          // Allow GET requests to billing invoices, but block admissions and other write requests
          const isBillingRead =
            request.method === 'GET' && path.startsWith('/billing/invoices');

          if (!isBillingRead) {
            throw new HttpException(
              {
                error: 'subscription_expired',
                message: 'Your school subscription has expired. Read-only limits apply to Admin portals.',
                role: 'SCHOOL_ADMIN',
                redirectUrl: '/dashboard/settings/subscription',
              },
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
        } else {
          // Teachers, Parents, Students are completely blocked from accessing non-exempt routes
          const message =
            user.role === 'TEACHER'
              ? 'School subscription has expired. Please contact your School Administrator to renew the EduTrack subscription.'
              : 'Your school\'s EduTrack subscription has expired. Please contact your School Administrator for assistance.';

          throw new HttpException(
            {
              error: 'subscription_expired',
              message,
              role: user.role,
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }
    } else {
      // Expiry date is in the future: ensure status is ACTIVE if it was expired/past due
      if (sub.status !== SubscriptionStatus.ACTIVE) {
        await this.prisma.tenantSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.ACTIVE },
        }).catch(() => {});
      }
    }

    // 4. Feature Gating Check
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredFeature) {
      const allowedFeatures = PLAN_FEATURES[sub.plan.name];
      if (!allowedFeatures || !allowedFeatures.includes(requiredFeature)) {
        throw new ForbiddenException({
          error: 'feature_locked',
          message: 'Upgrade your subscription plan to access this feature.',
          requiredFeature,
        });
      }
    }

    return true;
  }
}
