import { Module } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentSettingsController } from './payment-settings.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PaymentSettingsController],
  providers: [PaymentSettingsService, PrismaService],
  exports: [PaymentSettingsService],
})
export class PaymentSettingsModule {}
