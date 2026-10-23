import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function formatDatabaseUrl(rawUrl: string, connLimit: string, poolTimeout: string): string {
  try {
    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set('connection_limit', connLimit);
    urlObj.searchParams.set('pool_timeout', poolTimeout);
    return urlObj.toString();
  } catch {
    let cleaned = rawUrl
      .replace(/([?&])connection_limit=\d+(&|$)/g, '$1')
      .replace(/([?&])pool_timeout=\d+(&|$)/g, '$1')
      .replace(/[?&]$/, '');
    const sep = cleaned.includes('?') ? '&' : '?';
    return `${cleaned}${sep}connection_limit=${connLimit}&pool_timeout=${poolTimeout}`;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static instance: PrismaService;

  constructor() {
    let dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const connLimit = process.env.DB_CONNECTION_LIMIT || '10';
      const poolTimeout = process.env.DB_POOL_TIMEOUT || '20';
      dbUrl = formatDatabaseUrl(dbUrl, connLimit, poolTimeout);
    }

    if ((globalThis as any).prismaInstance) {
      return (globalThis as any).prismaInstance;
    }

    super({
      datasources: dbUrl
        ? {
            db: {
              url: dbUrl,
            },
          }
        : undefined,
      log: ['error'],
    });

    console.log(`[PrismaService] Initialized database client singleton (connection_limit: ${process.env.DB_CONNECTION_LIMIT || '10'}, pool_timeout: ${process.env.DB_POOL_TIMEOUT || '20'}s)`);
    (globalThis as any).prismaInstance = this;

    this.registerNotificationPushMiddleware();
  }

  private registerNotificationPushMiddleware() {
    this.$use(async (params, next) => {
      const result = await next(params);

      if (params.model === 'Notification' && (params.action === 'create' || params.action === 'createMany')) {
        try {
          const notificationsToDispatch: Array<{
            recipientId: string;
            tenantId?: string | null;
            title: string;
            message: string;
            type?: string | null;
            url?: string | null;
          }> = [];

          if (params.action === 'create' && result) {
            const item = result;
            const meta = params.args?.data?.metadata;
            let targetUrl = '/dashboard';
            if (meta) {
              if (typeof meta === 'string') {
                try { targetUrl = JSON.parse(meta).url || '/dashboard'; } catch {}
              } else if (meta.url) {
                targetUrl = meta.url;
              }
            } else if (params.args?.data?.url) {
              targetUrl = params.args.data.url;
            }

            notificationsToDispatch.push({
              recipientId: item.recipientId,
              tenantId: item.tenantId,
              title: item.title,
              message: item.message,
              type: item.type,
              url: targetUrl,
            });
          } else if (params.action === 'createMany') {
            const rawItems = Array.isArray(params.args?.data) ? params.args.data : [params.args?.data];
            for (const item of rawItems) {
              if (item && item.recipientId) {
                let targetUrl = '/dashboard';
                if (item.metadata) {
                  if (typeof item.metadata === 'string') {
                    try { targetUrl = JSON.parse(item.metadata).url || '/dashboard'; } catch {}
                  } else if (item.metadata.url) {
                    targetUrl = item.metadata.url;
                  }
                } else if (item.url) {
                  targetUrl = item.url;
                }

                notificationsToDispatch.push({
                  recipientId: item.recipientId,
                  tenantId: item.tenantId,
                  title: item.title,
                  message: item.message,
                  type: item.type,
                  url: targetUrl,
                });
              }
            }
          }

          if (notificationsToDispatch.length > 0) {
            setImmediate(() => {
              this.dispatchPushForNotifications(notificationsToDispatch).catch((err) => {
                console.warn('[PrismaService] Push dispatch failed:', err?.message || err);
              });
            });
          }
        } catch (hookErr: any) {
          console.warn('[PrismaService] Push middleware hook error:', hookErr?.message || hookErr);
        }
      }

      return result;
    });
  }

  private async dispatchPushForNotifications(
    items: Array<{
      recipientId: string;
      tenantId?: string | null;
      title: string;
      message: string;
      type?: string | null;
      url?: string | null;
    }>
  ) {
    let fbService: any = null;
    try {
      const { FirebaseAdminService } = require('./auth/firebase-admin.service');
      fbService = FirebaseAdminService.getInstance();
      if (!fbService || !fbService.isInitialized()) {
        const dummyConfig = {
          get: (key: string) => process.env[key],
        };
        const tempService = new FirebaseAdminService(dummyConfig as any);
        tempService.onModuleInit();
        fbService = tempService;
      }
    } catch (e: any) {
      console.warn('[PrismaService] Failed to load FirebaseAdminService for push:', e?.message || e);
      return;
    }

    if (!fbService || !fbService.isInitialized()) return;

    for (const item of items) {
      try {
        let tenantId = item.tenantId;
        if (!tenantId) {
          const user = await this.user.findUnique({
            where: { id: item.recipientId },
            select: { tenantId: true },
          });
          tenantId = user?.tenantId;
        }

        if (!tenantId) continue;

        // Multi-tenant check: ensure device token belongs to this user and tenant
        const deviceTokens = await this.deviceToken.findMany({
          where: {
            userId: item.recipientId,
            tenantId,
          },
          select: { token: true },
        });

        if (!deviceTokens || deviceTokens.length === 0) continue;

        const tokenStrings = deviceTokens.map((d) => d.token);

        const unreadCount = await this.notification.count({
          where: {
            recipientId: item.recipientId,
            tenantId,
            isRead: false,
          },
        });

        const pushData = {
          recipientId: item.recipientId,
          tenantId,
          url: item.url || '/dashboard',
          click_action: item.url || '/dashboard',
          type: item.type || 'IN_APP',
          badge: String(unreadCount),
        };

        const result = await fbService.sendPushNotification(
          tokenStrings,
          {
            title: item.title,
            body: item.message,
          },
          pushData,
          unreadCount
        );

        if (result.invalidTokens && result.invalidTokens.length > 0) {
          await this.deviceToken.deleteMany({
            where: { token: { in: result.invalidTokens } },
          });
        }
      } catch (err: any) {
        console.warn(`[PrismaService] Push delivery error for recipient ${item.recipientId}:`, err?.message || err);
      }
    }
  }

  async onModuleInit() {
    try {
      await this.withRetry(() => this.$connect(), 3, 200);
      console.log('[PrismaService] Database connection pool established successfully');
    } catch (err: any) {
      console.warn('[PrismaService] Database lazy connection fallback:', err?.message || err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => {});
  }

  public isTransientError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || error.toString() || '').toLowerCase();
    const code = error.code || '';

    return (
      msg.includes('idle-session timeout') ||
      msg.includes('idle_session_timeout') ||
      msg.includes('idle_in_transaction_session_timeout') ||
      msg.includes('terminating connection') ||
      msg.includes('connection closed') ||
      msg.includes('closed connection') ||
      msg.includes('connection reset') ||
      msg.includes('socket closed') ||
      msg.includes('broken pipe') ||
      msg.includes("can't reach database server") ||
      msg.includes('engine is not connected') ||
      msg.includes('server has closed the connection') ||
      msg.includes('connection pool timeout') ||
      msg.includes('timed out fetching a new connection') ||
      msg.includes('sorry, too many clients already') ||
      msg.includes('too many clients') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('epipe') ||
      msg.includes('econnrefused') ||
      msg.includes('ehostunreach') ||
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1017' ||
      code === 'P2024' ||
      code === '53300' ||
      code === '57P01' ||
      code === '57P02' ||
      code === '57P03' ||
      code === '57P05' ||
      code === '08000' ||
      code === '08003' ||
      code === '08006' ||
      code === '08001' ||
      code === '08004'
    );
  }

  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3, initialDelayMs = 200): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        const isTransient = this.isTransientError(error);
        if (attempt >= maxRetries || !isTransient) {
          throw error;
        }
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1); // 200ms, 400ms, 800ms
        console.warn(`[PrismaService] Transient connection issue (${error.code || 'transient'}). Retrying attempt ${attempt}/${maxRetries} after ${delayMs}ms...`);

        try {
          await this.$disconnect();
        } catch (_) {}

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        try {
          await this.$connect();
        } catch (_) {}
      }
    }
  }

  async ensureConnection(): Promise<boolean> {
    try {
      await this.withRetry(() => this.$queryRaw`SELECT 1`, 3, 200);
      return true;
    } catch (err: any) {
      console.error('[PrismaService] Database connection check failed:', err?.message || err);
      return false;
    }
  }
}

