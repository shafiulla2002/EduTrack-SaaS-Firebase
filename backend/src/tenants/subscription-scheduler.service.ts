import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionSchedulerService implements OnModuleInit, OnModuleDestroy {
  private initialTimeoutId: NodeJS.Timeout | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    console.log('[SubscriptionScheduler] Initializing subscription scheduler...');

    // Run checks on startup after a brief delay
    this.initialTimeoutId = setTimeout(() => {
      this.runExpiryNotificationChecks().catch((err) => {
        console.error('[SubscriptionScheduler] Unhandled error in startup check:', err?.message || err);
      });
    }, 10000);

    // Run every 24 hours
    this.intervalId = setInterval(() => {
      this.runExpiryNotificationChecks().catch((err) => {
        console.error('[SubscriptionScheduler] Unhandled error in recurring check:', err?.message || err);
      });
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.initialTimeoutId) {
      clearTimeout(this.initialTimeoutId);
      this.initialTimeoutId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async runExpiryNotificationChecks() {
    if (this.isRunning) {
      console.warn('[SubscriptionScheduler] Previous subscription check is still running. Skipping overlapping run.');
      return;
    }

    this.isRunning = true;
    const maxRetries = 3;
    const retryDelays = [2000, 4000, 8000];

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log('[SubscriptionScheduler] Starting expiry check...');
        try {
          await this.executeExpiryChecks();
          console.log('[SubscriptionScheduler] Expiry check completed successfully');
          return;
        } catch (error: any) {
          const isTransient = this.prisma.isTransientError(error);
          if (attempt < maxRetries && isTransient) {
            console.warn(`[SubscriptionScheduler] Database connection error, retrying attempt ${attempt}/${maxRetries}...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt - 1] || 2000));
          } else {
            console.error(`[SubscriptionScheduler] Expiry check failed after ${attempt} attempts:`, error?.message || error);
            break;
          }
        }
      }
    } catch (unexpectedError: any) {
      console.error('[SubscriptionScheduler] Unexpected error during subscription checks:', unexpectedError?.message || unexpectedError);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeExpiryChecks() {
    const now = new Date();

    const subscriptions = await this.prisma.withRetry(() =>
      this.prisma.tenantSubscription.findMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        },
        include: { tenant: true, plan: true },
      })
    );

    console.log(`[SubscriptionScheduler] Found ${subscriptions.length} active/ past-due subscriptions`);

    for (const sub of subscriptions) {
      try {
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
          const admins = await this.prisma.withRetry(() =>
            this.prisma.user.findMany({
              where: {
                tenantId: sub.tenantId,
                role: 'SCHOOL_ADMIN',
                isActive: true,
              },
            })
          );

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
            await this.prisma.withRetry(() =>
              this.prisma.notification.create({
                data: {
                  title: 'Subscription Expiry Notice',
                  message,
                  type: 'IN_APP',
                  recipientId: admin.id,
                  isRead: false,
                },
              })
            ).catch((err) =>
              console.error(`[SubscriptionScheduler] Failed to create In-App notification for tenant ${sub.tenantId}:`, err?.message || err)
            );

            // 2. Log in SubscriptionNotificationLog for auditing
            await this.prisma.withRetry(() =>
              this.prisma.subscriptionNotificationLog.create({
                data: {
                  tenantId: sub.tenantId,
                  daysBeforeExpiry,
                  notificationType,
                  channel: 'IN_APP',
                  status: 'SUCCESS',
                },
              })
            ).catch((err) =>
              console.error(`[SubscriptionScheduler] Failed to log SubscriptionNotificationLog for tenant ${sub.tenantId}:`, err?.message || err)
            );
          }
        }
      } catch (subError: any) {
        console.error(`[SubscriptionScheduler] Error processing subscription ${sub.id} (tenant ${sub.tenantId}):`, subError?.message || subError);
      }
    }
  }
}

