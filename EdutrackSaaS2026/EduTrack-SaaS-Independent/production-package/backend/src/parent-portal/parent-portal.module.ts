import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { PrismaService } from '../prisma.service';
import { BillingModule } from '../billing/billing.module';
import { StorageService } from '../common/storage.service';
import { ExamConfigModule } from '../exam-config/exam-config.module';

@Module({
  imports: [BillingModule, ExamConfigModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService, PrismaService, StorageService],
})
export class ParentPortalModule {}
