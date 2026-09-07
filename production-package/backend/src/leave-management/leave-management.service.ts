import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role } from '@prisma/client';

@Injectable()
export class LeaveManagementService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  async getLeaveRequests(
    userId: string,
    query?: {
      page?: number;
      limit?: number;
      status?: string;
      applicantType?: string;
      leaveType?: string;
      academicYearId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const tenantId = this.getTenantId();

    const whereClause: any = { tenantId };

    if (query) {
      const andConditions: any[] = [];

      if (query.status && query.status !== 'ALL') {
        andConditions.push({ status: query.status.toUpperCase() });
      }
      if (query.applicantType && query.applicantType !== 'ALL') {
        const appType = query.applicantType.toUpperCase();
        if (appType === 'STUDENT' || appType === 'PARENT') {
          andConditions.push({ applicantType: 'STUDENT' });
        } else if (appType === 'TEACHER' || appType === 'STAFF') {
          andConditions.push({ applicantType: 'STAFF' });
        }
      }
      if (query.leaveType && query.leaveType !== 'ALL') {
        andConditions.push({ leaveType: query.leaveType });
      }
      if (query.startDate) {
        andConditions.push({ startDate: { gte: new Date(query.startDate) } });
      }
      if (query.endDate) {
        andConditions.push({ endDate: { lte: new Date(query.endDate) } });
      }
      if (query.search) {
        const sTerm = query.search;
        andConditions.push({
          OR: [
            { teacher: { user: { name: { contains: sTerm, mode: 'insensitive' } } } },
            { teacher: { employeeId: { contains: sTerm, mode: 'insensitive' } } },
            { student: { user: { name: { contains: sTerm, mode: 'insensitive' } } } },
            { student: { rollNo: { contains: sTerm, mode: 'insensitive' } } },
          ]
        });
      }
      if (query.academicYearId && query.academicYearId !== 'ALL') {
        andConditions.push({
          OR: [
            { student: { classSection: { class: { academicYearId: query.academicYearId } } } },
            { teacher: { classSections: { some: { class: { academicYearId: query.academicYearId } } } } }
          ]
        });
      }

      if (andConditions.length > 0) {
        whereClause.AND = andConditions;
      }
    }

    const total = await this.prisma.leaveRequest.count({ where: whereClause });

    let orderBy: any = { createdAt: 'desc' };
    if (query?.sortBy) {
      const order = query.sortOrder === 'asc' ? 'asc' : 'desc';
      if (query.sortBy === 'appliedDate') {
        orderBy = { createdAt: order };
      } else if (query.sortBy === 'startDate') {
        orderBy = { startDate: order };
      } else if (query.sortBy === 'status') {
        orderBy = { status: order };
      } else if (query.sortBy === 'applicantName') {
        orderBy = { createdAt: order }; // Fallback
      }
    }

    const selectOrInclude = {
      include: {
        teacher: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            classSection: { include: { class: true, section: true } }
          }
        },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      }
    };

    let leaves = [];
    if (query?.page && query?.limit) {
      const pageNum = Number(query.page);
      const limitNum = Number(query.limit);
      leaves = await this.prisma.leaveRequest.findMany({
        where: whereClause,
        ...selectOrInclude,
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      });

      const leaveIds = leaves.map(l => l.id);
      const histories = await this.prisma.statusHistory.findMany({
        where: { entityType: 'LEAVE_REQUEST', entityId: { in: leaveIds } },
        include: { updatedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const historyMap = new Map<string, any[]>();
      for (const h of histories) {
        if (!historyMap.has(h.entityId)) historyMap.set(h.entityId, []);
        historyMap.get(h.entityId)!.push(h);
      }

      const data = leaves.map(l => ({
        ...l,
        statusHistories: historyMap.get(l.id) || [],
      }));

      return {
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } else {
      leaves = await this.prisma.leaveRequest.findMany({
        where: whereClause,
        ...selectOrInclude,
        orderBy,
      });

      const leaveIds = leaves.map(l => l.id);
      const histories = await this.prisma.statusHistory.findMany({
        where: { entityType: 'LEAVE_REQUEST', entityId: { in: leaveIds } },
        include: { updatedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const historyMap = new Map<string, any[]>();
      for (const h of histories) {
        if (!historyMap.has(h.entityId)) historyMap.set(h.entityId, []);
        historyMap.get(h.entityId)!.push(h);
      }

      return leaves.map(l => ({
        ...l,
        statusHistories: historyMap.get(l.id) || [],
      }));
    }
  }

  async getLeaveStats() {
    const tenantId = this.getTenantId();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      pending,
      approvedToday,
      rejectedToday,
      totalThisMonth,
      totalThisYear
    ] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'APPROVED',
          approvedDate: { gte: todayStart }
        }
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'REJECTED',
          rejectedDate: { gte: todayStart }
        }
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          createdAt: { gte: monthStart }
        }
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          createdAt: { gte: yearStart }
        }
      })
    ]);

    return {
      pending,
      approvedToday,
      rejectedToday,
      totalThisMonth,
      totalThisYear
    };
  }

  async getApplicantLeaveHistory(applicantType: string, applicantId: string) {
    const tenantId = this.getTenantId();
    const isStudent = applicantType.toUpperCase() === 'STUDENT' || applicantType.toUpperCase() === 'PARENT';
    const where: any = { tenantId };
    if (isStudent) {
      where.studentId = applicantId;
    } else {
      where.teacherId = applicantId;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        approvedBy: { select: { name: true } }
      }
    });
  }

  async updateLeaveStatus(userId: string, id: string, data: { status: string; comments?: string }) {
    const tenantId = this.getTenantId();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      }
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    const rawStatus = data.status || 'Approved';
    const statusUpper = rawStatus.toUpperCase();
    const finalStatus = statusUpper === 'APPROVED' ? 'APPROVED' : statusUpper === 'REJECTED' ? 'REJECTED' : rawStatus;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          comments: data.comments || null,
          approver: user.name,
          approvedById: user.id,
          approvedRole: 'ADMIN',
          approvedDate: finalStatus === 'APPROVED' ? new Date() : null,
          rejectedDate: finalStatus === 'REJECTED' ? new Date() : null,
        }
      });

      await tx.statusHistory.create({
        data: {
          entityType: 'LEAVE_REQUEST',
          entityId: id,
          previousStatus: leave.status,
          currentStatus: finalStatus,
          remarks: data.comments || null,
          updatedById: user.id,
          tenantId,
        }
      });

      await tx.notification.updateMany({
        where: {
          type: 'LEAVE_APPROVAL',
          message: { contains: `LeaveRequestId: ${id}` }
        },
        data: {
          isRead: true
        }
      });

      const displayStatus = finalStatus === 'APPROVED' ? 'Approved' : finalStatus === 'REJECTED' ? 'Rejected' : finalStatus;
      if (leave.applicantType === 'STUDENT' && leave.submittedById) {
        await tx.notification.create({
          data: {
            title: `Student Leave Application ${displayStatus}`,
            message: `The leave application for student ${leave.student?.user?.name || ''} (${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''} to ${leave.endDate ? leave.endDate.toISOString().split('T')[0] : ''}) has been ${displayStatus.toLowerCase()}.${data.comments ? ' Remarks: ' + data.comments : ''}`,
            type: 'LEAVE_APPROVAL',
            recipientId: leave.submittedById,
          }
        });
      } else if (leave.teacher?.userId) {
        await tx.notification.create({
          data: {
            title: `Leave Request ${displayStatus}`,
            message: `Your ${leave.leaveType} leave request from ${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''} to ${leave.endDate ? leave.endDate.toISOString().split('T')[0] : ''} has been ${displayStatus.toLowerCase()}.${data.comments ? ' Remarks: ' + data.comments : ''}`,
            type: 'IN_APP',
            recipientId: leave.teacher.userId,
          }
        });
      }

      return updated;
    });
  }

  async bulkUpdateLeaveStatus(userId: string, ids: string[], data: { status: string; comments?: string }) {
    const tenantId = this.getTenantId();
    const results = [];

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      const rawStatus = data.status || 'Approved';
      const statusUpper = rawStatus.toUpperCase();
      const finalStatus = statusUpper === 'APPROVED' ? 'APPROVED' : statusUpper === 'REJECTED' ? 'REJECTED' : rawStatus;

      for (const id of ids) {
        const leave = await tx.leaveRequest.findFirst({
          where: { id, tenantId },
          include: {
            teacher: { include: { user: true } },
            student: { include: { user: true } },
          }
        });
        if (!leave) continue;

        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: finalStatus,
            comments: data.comments || null,
            approver: user.name,
            approvedById: user.id,
            approvedRole: 'ADMIN',
            approvedDate: finalStatus === 'APPROVED' ? new Date() : null,
            rejectedDate: finalStatus === 'REJECTED' ? new Date() : null,
          }
        });

        await tx.statusHistory.create({
          data: {
            entityType: 'LEAVE_REQUEST',
            entityId: id,
            previousStatus: leave.status,
            currentStatus: finalStatus,
            remarks: data.comments || null,
            updatedById: user.id,
            tenantId,
          }
        });

        await tx.notification.updateMany({
          where: {
            type: 'LEAVE_APPROVAL',
            message: { contains: `LeaveRequestId: ${id}` }
          },
          data: {
            isRead: true
          }
        });

        const displayStatus = finalStatus === 'APPROVED' ? 'Approved' : finalStatus === 'REJECTED' ? 'Rejected' : finalStatus;
        if (leave.applicantType === 'STUDENT' && leave.submittedById) {
          await tx.notification.create({
            data: {
              title: `Student Leave Application ${displayStatus}`,
              message: `The leave application for student ${leave.student?.user?.name || ''} (${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''} to ${leave.endDate ? leave.endDate.toISOString().split('T')[0] : ''}) has been ${displayStatus.toLowerCase()}.${data.comments ? ' Remarks: ' + data.comments : ''}`,
              type: 'LEAVE_APPROVAL',
              recipientId: leave.submittedById,
            }
          });
        } else if (leave.teacher?.userId) {
          await tx.notification.create({
            data: {
              title: `Leave Request ${displayStatus}`,
              message: `Your ${leave.leaveType} leave request from ${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''} to ${leave.endDate ? leave.endDate.toISOString().split('T')[0] : ''} has been ${displayStatus.toLowerCase()}.${data.comments ? ' Remarks: ' + data.comments : ''}`,
              type: 'IN_APP',
              recipientId: leave.teacher.userId,
            }
          });
        }

        results.push(updated);
      }
      return { success: true, count: results.length };
    });
  }
}
