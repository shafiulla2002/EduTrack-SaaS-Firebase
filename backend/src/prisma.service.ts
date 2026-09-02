import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static instance: PrismaService;

  constructor() {
    let dbUrl = process.env.DATABASE_URL || "postgresql://edutrack_app:edutrack%402026@34.180.7.94:5432/edutrack?sslmode=require";
    if (!dbUrl.includes('connection_limit')) {
      const sep = dbUrl.includes('?') ? '&' : '?';
      dbUrl += `${sep}connection_limit=3&pool_timeout=10`;
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: ['error'],
    });

    if (PrismaService.instance) {
      return PrismaService.instance;
    }

    console.log("PrismaService DATABASE_URL (initialized new singleton):", process.env.DATABASE_URL);
    PrismaService.instance = this;
  }

  async onModuleInit() {
    // Lazily connect on first query to prevent bootup connection timeouts
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
