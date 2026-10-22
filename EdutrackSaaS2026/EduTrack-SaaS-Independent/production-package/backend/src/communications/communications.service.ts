import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';

@Injectable()
export class CommunicationsService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  async sendNotification(data: any) {
    const tenantId = this.getTenantId();
    const notification = await this.prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type, // IN_APP, EMAIL, SMS
        recipientId: data.recipientId,
      },
    });
    // Mock dispatch console alerts representing "SMS/Email Ready Architecture"
    console.log(`[DISPATCH] [${data.type}] To User ID: ${data.recipientId}`);
    console.log(`Subject: ${data.title}`);
    console.log(`Content: ${data.message}`);
    return notification;
  }

  async getNotifications(recipientId: string) {
    const tenantId = this.getTenantId();
    const user = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException('Recipient user not found in this school context');
    }
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
    });
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
