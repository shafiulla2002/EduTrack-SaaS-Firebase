import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { FirebaseAdminService } from '../auth/firebase-admin.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebaseAdmin: FirebaseAdminService,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  /**
   * Register or update a device push token for an authenticated user and tenant.
   * If the token was previously registered to a different user, it is reassociated
   * to guarantee no notifications leak across user or tenant boundaries.
   */
  async registerDeviceToken(
    userId: string,
    tenantId: string,
    token: string,
    platform: string = 'ANDROID',
    deviceInfo?: string,
  ) {
    if (!token) throw new BadRequestException('Device token is required');
    if (!userId || !tenantId) throw new BadRequestException('User ID and Tenant ID are required');

    try {
      const existing = await this.prisma.deviceToken.findUnique({
        where: { token },
      });

      if (existing) {
        return await this.prisma.deviceToken.update({
          where: { token },
          data: {
            userId,
            tenantId,
            platform: platform.toUpperCase(),
            deviceInfo: deviceInfo || existing.deviceInfo,
            updatedAt: new Date(),
          },
        });
      }

      return await this.prisma.deviceToken.create({
        data: {
          token,
          userId,
          tenantId,
          platform: platform.toUpperCase(),
          deviceInfo: deviceInfo || null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to register device token: ${err.message}`, err.stack);
      throw new BadRequestException('Failed to register device token');
    }
  }

  /**
   * Unregister a device token on explicit user logout or token revocation.
   */
  async unregisterDeviceToken(token: string) {
    if (!token) return { success: true };
    try {
      await this.prisma.deviceToken.deleteMany({
        where: { token },
      });
      return { success: true, message: 'Device token removed successfully' };
    } catch (err: any) {
      this.logger.warn(`Failed to unregister device token: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  /**
   * Send FCM push notification strictly isolated to recipientId and tenantId.
   */
  async sendPushToUser(
    recipientId: string,
    tenantId: string,
    payload: { title: string; body: string; data?: Record<string, any> },
  ) {
    if (!recipientId || !tenantId) return { successCount: 0, failureCount: 0 };

    try {
      // Find all active tokens for this user strictly within this tenant
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: { userId: recipientId, tenantId },
        select: { token: true },
      });

      if (!deviceTokens || deviceTokens.length === 0) {
        return { successCount: 0, failureCount: 0 };
      }

      const tokenStrings = deviceTokens.map(d => d.token);

      const fcmData: Record<string, string> = {
        tenantId,
        recipientId,
        click_action: payload.data?.url || '/dashboard',
        url: payload.data?.url || '/dashboard',
        type: payload.data?.type || 'IN_APP',
        ...(payload.data || {}),
      };

      const result = await this.firebaseAdmin.sendPushNotification(
        tokenStrings,
        { title: payload.title, body: payload.body },
        fcmData,
      );

      // Clean up stale or unregistered tokens
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: result.invalidTokens } },
        });
        this.logger.log(`Purged ${result.invalidTokens.length} invalid/expired device tokens`);
      }

      return result;
    } catch (err: any) {
      this.logger.error(`Error sending push to user ${recipientId}: ${err.message}`, err.stack);
      return { successCount: 0, failureCount: 0 };
    }
  }

  /**
   * Send FCM push notification strictly to multiple users within a tenant.
   */
  async sendPushToUsers(
    recipientIds: string[],
    tenantId: string,
    payload: { title: string; body: string; data?: Record<string, any> },
  ) {
    if (!recipientIds || recipientIds.length === 0 || !tenantId) return { successCount: 0, failureCount: 0 };

    try {
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: {
          userId: { in: recipientIds },
          tenantId,
        },
        select: { token: true },
      });

      if (!deviceTokens || deviceTokens.length === 0) {
        return { successCount: 0, failureCount: 0 };
      }

      const tokenStrings = deviceTokens.map(d => d.token);
      const fcmData: Record<string, string> = {
        tenantId,
        click_action: payload.data?.url || '/dashboard',
        url: payload.data?.url || '/dashboard',
        type: payload.data?.type || 'IN_APP',
        ...(payload.data || {}),
      };

      const result = await this.firebaseAdmin.sendPushNotification(
        tokenStrings,
        { title: payload.title, body: payload.body },
        fcmData,
      );

      if (result.invalidTokens && result.invalidTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: result.invalidTokens } },
        });
      }

      return result;
    } catch (err: any) {
      this.logger.error(`Error in sendPushToUsers: ${err.message}`);
      return { successCount: 0, failureCount: 0 };
    }
  }

  async sendNotification(data: any) {
    let tenantId = data.tenantId;
    if (!tenantId) {
      try {
        tenantId = this.getTenantId();
      } catch {
        // Fallback to recipient's tenant
        const user = await this.prisma.user.findUnique({
          where: { id: data.recipientId },
          select: { tenantId: true },
        });
        tenantId = user?.tenantId;
      }
    }

    if (!tenantId) {
      throw new BadRequestException('Cannot determine tenant context for notification');
    }

    // Persist in database
    const notification = await this.prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'IN_APP', // IN_APP, EMAIL, SMS, PUSH
        recipientId: data.recipientId,
        tenantId,
        metadata: data.metadata || null,
      },
    });

    // Universal real-time push dispatch is handled automatically by PrismaService middleware for all notification creations
    this.logger.log(`[NOTIFICATION_CREATED] [${data.type || 'IN_APP'}] Tenant: ${tenantId} Recipient: ${data.recipientId}`);
    return notification;
  }

  async getNotifications(recipientId: string, tenantId?: string) {
    if (!recipientId) return [];
    try {
      const activeTenant = tenantId || this.getTenantId();
      const user = await this.prisma.user.findUnique({ where: { id: recipientId }, select: { tenantId: true } });
      if (!user || (user.tenantId && user.tenantId !== activeTenant)) {
        return [];
      }
      return await this.prisma.notification.findMany({
        where: {
          recipientId,
          OR: [
            { tenantId: activeTenant },
            { tenantId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch {
      return [];
    }
  }

  async getUnreadCount(recipientId: string, tenantId?: string): Promise<{ count: number }> {
    if (!recipientId) return { count: 0 };
    try {
      const activeTenant = tenantId || this.getTenantId();
      const count = await this.prisma.notification.count({
        where: {
          recipientId,
          isRead: false,
          OR: [
            { tenantId: activeTenant },
            { tenantId: null },
          ],
        },
      });
      return { count };
    } catch {
      return { count: 0 };
    }
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ---------- Communication Center APIs ----------

  async createCommunication(data: any) {
    const tenantId = this.getTenantId();
    const { headline, subject, message, type, priority, audienceGroups, scheduledAt, attachments } = data;
    const communication = await this.prisma.communication.create({
      data: {
        tenantId,
        createdById: data.createdById || data.senderId || data.userId || '', // will be set by auth guard
        headline,
        subject,
        message,
        type,
        priority,
        audienceGroups,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        attachments: {
          create: (attachments || []).map((att: any) => ({ url: att.url, filename: att.filename })),
        },
      },
    });
    return communication;
  }

  async listCommunications(filter: any = {}) {
    const tenantId = this.getTenantId();
    return this.prisma.communication.findMany({
      where: { tenantId, ...filter },
      orderBy: { createdAt: 'desc' },
      include: { attachments: true },
    });
  }

  async getCommunication(id: string) {
    const tenantId = this.getTenantId();
    const comm = await this.prisma.communication.findUnique({
      where: { id },
      include: { attachments: true, recipients: true },
    });
    if (!comm || comm.tenantId !== tenantId) {
      throw new NotFoundException('Communication not found');
    }
    return comm;
  }

  async updateCommunication(id: string, data: any) {
    const tenantId = this.getTenantId();
    const existing = await this.prisma.communication.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Communication not found');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new BadRequestException('Only draft or scheduled communications can be updated');
    }
    return this.prisma.communication.update({
      where: { id },
      data: {
        headline: data.headline,
        subject: data.subject,
        message: data.message,
        type: data.type,
        priority: data.priority,
        audienceGroups: data.audienceGroups,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.status || existing.status,
        // Attachments handling omitted for brevity
      },
    });
  }

  /** Resolve audience groups into CommunicationRecipient records */
  async resolveAudience(communicationId: string) {
    const tenantId = this.getTenantId();
    const comm = await this.prisma.communication.findUnique({ where: { id: communicationId } });
    if (!comm || comm.tenantId !== tenantId) {
      throw new NotFoundException('Communication not found');
    }
    const groups = comm.audienceGroups || [];
    const recipientIds = new Set<string>();
    for (const group of groups) {
      if (group === 'ALL_TEACHERS') {
        const teachers = await this.prisma.user.findMany({ where: { role: 'TEACHER', tenantId }, select: { id: true } });
        teachers.forEach(t => recipientIds.add(t.id));
      } else if (group.startsWith('CLASS_')) {
        const classId = group.split('_')[1];
        const students = await this.prisma.studentProfile.findMany({ where: { classSectionId: classId }, select: { id: true } });
        students.forEach(s => recipientIds.add(s.id));
      }
      // Additional group handling (e.g., PARENTS, STAFF) can be added here
    }
    const createData = Array.from(recipientIds).map(uid => ({ communicationId, userId: uid, tenantId }));
    await this.prisma.communicationRecipient.createMany({ data: createData, skipDuplicates: true });
    return { count: recipientIds.size };
  }

  /** Mark a recipient as delivered/read */
  async markRecipientStatus(recipientId: string, status: 'DELIVERED' | 'READ') {
    const tenantId = this.getTenantId();
    const recipient = await this.prisma.communicationRecipient.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.tenantId !== tenantId) {
      throw new NotFoundException('Recipient not found');
    }
    const data: any = {};
    if (status === 'DELIVERED') {
      data.deliveredAt = new Date();
      data.status = 'DELIVERED';
    } else if (status === 'READ') {
      data.readAt = new Date();
      data.status = 'READ';
    }
    return this.prisma.communicationRecipient.update({ where: { id: recipientId }, data });
  }

  async deleteNotification(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async clearReadNotifications(recipientId: string) {
    const tenantId = this.getTenantId();
    return this.prisma.notification.deleteMany({
      where: { recipientId, isRead: true },
    });
  }
}
