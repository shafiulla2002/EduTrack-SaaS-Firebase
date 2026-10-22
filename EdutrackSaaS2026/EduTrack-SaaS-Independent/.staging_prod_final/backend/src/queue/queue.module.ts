import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CloudStorageService } from '../common/services/cloud-storage.service';
import { AwsSesService } from '../common/services/aws-ses.service';
import { InvoicePdfService } from '../saas-billing/invoice-pdf.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    QueueService,
    CloudStorageService,
    AwsSesService,
    InvoicePdfService,
    PrismaService,
  ],
  exports: [QueueService, CloudStorageService, AwsSesService, InvoicePdfService],
})
export class QueueModule {}
