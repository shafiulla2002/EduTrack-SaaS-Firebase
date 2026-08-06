import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AuditLogService, AuditLogInterceptor, PrismaService],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
