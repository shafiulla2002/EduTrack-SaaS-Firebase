import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from '../prisma.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SaaSBillingModule } from '../saas-billing/saas-billing.module';

@Module({
  imports: [SubscriptionModule, SaaSBillingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
