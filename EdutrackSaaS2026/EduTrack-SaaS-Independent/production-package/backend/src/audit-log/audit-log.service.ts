import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(performedBy: string, action: string, entityType?: string, entityId?: string, metadata?: any) {
    return this.prisma.auditLog.create({
      data: {
        performedBy,
        action,
        entityType: entityType || 'SYSTEM',
        entityId: entityId || null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  }

  async getAuditLogs(performedBy?: string, entityType?: string) {
    const where: any = {};
    if (performedBy) where.performedBy = performedBy;
    if (entityType) where.entityType = entityType;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
