import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionSchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalId: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    console.log('[SubscriptionScheduler] Initializing subscription scheduler...');
    // Run checks immediately on startup after a brief delay
    setTimeout(() => {
      this.runExpiryNotificationChecks();
    }, 10000);

    // Run every 24 hours
    this.intervalId = setInterval(() => {
      this.runExpiryNotificationChecks();
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async runExpiryNotificationChecks() {
    console.log('[SubscriptionScheduler] Running daily subscription checks...');
    try {
      const now = new Date();
      const subscriptions = await this.prisma.tenantSubscription.findMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        },
        include: { tenant: true, plan: true },
      });

      for (const sub of subscriptions) {
        const expiry = new Date(sub.expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let daysBeforeExpiry: number | null = null;
        let notificationType = '';

        if (diffDays === 15 || diffDays === 7 || diffDays === 3 || diffDays === 1) {
          daysBeforeExpiry = diffDays;
          notificationType = 'BEFORE_EXPIRY';
        } else if (diffDays === 0) {
          daysBeforeExpiry = 0;
          notificationType = 'ON_EXPIRY';
        } else if (diffDays < 0) {
          // Inside 3-day grace period (diffDays: -1, -2, -3)
          if (diffDays >= -3) {
            daysBeforeExpiry = diffDays;
            notificationType = 'GRACE_PERIOD';
          }
        }

        if (notificationType) {
          const admins = await this.prisma.user.findMany({
            where: {
              tenantId: sub.tenantId,
              role: 'SCHOOL_ADMIN',
              isActive: true,
            },
          });

          for (const admin of admins) {
            let message = '';
            if (notificationType === 'BEFORE_EXPIRY') {
              message = `Your school's EduTrack ${sub.plan.name} subscription will expire in ${diffDays} days on ${expiry.toDateString()}. Please renew soon.`;
            } else if (notificationType === 'ON_EXPIRY') {
              message = `Your school's EduTrack subscription has expired today. You are now entering a 3-day grace period.`;
            } else if (notificationType === 'GRACE_PERIOD') {
              message = `Your school's EduTrack subscription is expired (Grace Period: Day ${Math.abs(diffDays)} of 3). Please renew to prevent lockout.`;
            }

            // 1. Create In-App Notification record for Admin user
            await this.prisma.notification.create({
              data: {
                title: 'Subscription Expiry Notice',
                message,
                type: 'IN_APP',
                recipientId: admin.id,
                isRead: false,
              },
            }).catch(err => console.error('Failed to log In-App notification:', err));

            // 2. Log in SubscriptionNotificationLog for auditing
            await this.prisma.subscriptionNotificationLog.create({
              data: {
                tenantId: sub.tenantId,
                daysBeforeExpiry,
                notificationType,
                channel: 'IN_APP',
                status: 'SUCCESS',
              },
            }).catch(err => console.error('Failed to log SubscriptionNotificationLog:', err));
          }
        }
      }
    } catch (e) {
      console.error('[SubscriptionScheduler] Error during daily checks:', e);
    }
  }
}
