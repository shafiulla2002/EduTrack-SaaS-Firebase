import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found for logging');
    }
    return tenantId;
  }

  async logActivity(
    userId: string,
    action: string,
    entityName: string,
    entityId?: string,
    details?: string,
  ) {
    const tenantId = this.getTenantId();
    return this.prisma.activityLog.create({
      data: {
        userId,
        action,
        entityName,
        entityId: entityId || null,
        details: details || null,
        tenantId,
      },
    });
  }

  async getLogs(userId?: string, action?: string, entityName?: string) {
    const tenantId = this.getTenantId();
    return this.prisma.activityLog.findMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        ...(action ? { action } : {}),
        ...(entityName ? { entityName } : {}),
      },
      include: {
        user: {
          select: { name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }
}
