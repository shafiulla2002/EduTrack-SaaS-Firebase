import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [StudentsService, PrismaService, StorageService],
  controllers: [StudentsController],
  exports: [StudentsService, StorageService],
})
export class StudentsModule {}
