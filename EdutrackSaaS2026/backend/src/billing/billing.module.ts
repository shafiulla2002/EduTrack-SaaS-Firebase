import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController, PublicBillingController } from './billing.controller';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';

@Module({
  providers: [BillingService, PrismaService, StorageService],
  controllers: [BillingController, PublicBillingController],
  exports: [BillingService],
})
export class BillingModule {}
