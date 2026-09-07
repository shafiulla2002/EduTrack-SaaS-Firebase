import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static instance: PrismaService;

  constructor() {
    let dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.includes('connection_limit')) {
      const sep = dbUrl.includes('?') ? '&' : '?';
      dbUrl += `${sep}connection_limit=25&pool_timeout=15`;
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

    if (PrismaService.instance) {
      return PrismaService.instance;
    }

    console.log('[PrismaService] Initialized database client singleton');
    PrismaService.instance = this;
  }

  async onModuleInit() {
    // Lazily connect on first query to prevent bootup connection timeouts
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
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('epipe') ||
      msg.includes('econnrefused') ||
      msg.includes('ehostunreach') ||
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1017' ||
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

  async withRetry<T>(operation: () => Promise<T>, maxRetries = 3, initialDelayMs = 1000): Promise<T> {
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
        console.warn(`[PrismaService] Transient database connection issue detected. Retrying attempt ${attempt}/${maxRetries} after ${initialDelayMs * attempt}ms...`);

        try {
          await this.$disconnect();
        } catch (_) {}

        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));

        try {
          await this.$connect();
        } catch (_) {}
      }
    }
  }

  async ensureConnection(): Promise<boolean> {
    try {
      await this.withRetry(() => this.$queryRaw`SELECT 1`, 2, 500);
      return true;
    } catch (err: any) {
      console.error('[PrismaService] Database connection check failed:', err?.message || err);
      return false;
    }
  }
}

