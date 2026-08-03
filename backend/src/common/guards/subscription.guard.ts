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

    // Exempt paths: Auth profiles, Logout, Setup/Branding views, Subscription controller, Support requests, Super Admin
    const path = request.path;
    const isExemptPath =
      path.startsWith('/auth/') ||
      path.startsWith('/tenant/subscription') ||
      path.startsWith('/tenant/setup-status') ||
      path.startsWith('/tenant/public-branding') ||
      path.startsWith('/support') ||
      path.startsWith('/super-admin') ||
      path.includes('/profile'); // Allow profile endpoints

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
        // Post Grace Period: Locked Mode
        if (sub.status !== SubscriptionStatus.EXPIRED) {
          await this.prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          }).catch(() => {});
        }

        if (isExemptPath) {
          return true;
        }

        throw new HttpException(
          {
            error: 'subscription_expired',
            message: "Your school's subscription has expired or there is no active subscription. Please renew your subscription to continue using EduTrack.",
            role: user.role,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
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

    return true;
  }
}
