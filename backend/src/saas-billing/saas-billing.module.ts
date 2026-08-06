import { Module } from '@nestjs/common';
import { SaaSBillingService } from './saas-billing.service';
import { SaaSBillingController } from './saas-billing.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SaaSBillingController],
  providers: [SaaSBillingService, PrismaService],
  exports: [SaaSBillingService],
})
export class SaaSBillingModule {}
