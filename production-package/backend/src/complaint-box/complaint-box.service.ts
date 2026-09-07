import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CreateBehaviorDto } from './dto/create-behavior.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@Injectable()
export class ComplaintBoxService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active tenant context');
    }
    return tenantId;
  }

  /** Returns the profile of the currently authenticated teacher. */
  async getCurrentTeacher() {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;
    if (!user || !user.id) {
      throw new BadRequestException('User not authenticated');
    }
    const profile = await this.prisma.staffProfile.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });
    if (!profile || profile.user.tenantId !== tenantId) {
      throw new NotFoundException('Teacher profile not found');
    }
    return profile;
  }

  /** Returns class sections (classes) assigned to the teacher, or all class sections for admins. */
  async getStudentClasses() {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (!staffProfile) {
        return [];
      }

      const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
      const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
      const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

      return this.prisma.classSection.findMany({
        where: { tenantId, id: { in: classSectionIds } },
        include: { class: true, section: true },
        orderBy: { class: { name: 'asc' } },
      });
    }

    return this.prisma.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true },
      orderBy: { class: { name: 'asc' } },
    });
  }

  /** Returns all teachers for the tenant. */
  async getTeachers() {
    const tenantId = this.getTenantId();
    return this.prisma.staffProfile.findMany({
      where: { user: { tenantId, role: 'TEACHER', isActive: true } },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  /** Returns students belonging to a specific class section. Enforces teacher-class assignment. */
  async getStudentsByClass(classSectionId: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (!staffProfile) {
        throw new ForbiddenException('Teacher profile not found.');
      }

      const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
      const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
      const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

      if (!classSectionIds.includes(classSectionId)) {
        throw new ForbiddenException('You do not have permission to access students in this class section.');
      }
    }

    return this.prisma.studentProfile.findMany({
      where: {
        user: { tenantId },
        classSectionId,
      },
      include: { user: true, classSection: { include: { class: true, section: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }

  /** Searches students across the tenant. Filters to assigned classes for teachers. */
  async searchStudents(searchTerm?: string, classId?: string, sectionId?: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const filter: any = {
      user: { tenantId, isActive: true }
    };

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (!staffProfile) {
        return [];
      }

      const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
      const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
      const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

      filter.classSectionId = { in: classSectionIds };
    }

    if (classId || sectionId) {
      filter.classSection = {
        classId: classId || undefined,
        sectionId: sectionId || undefined,
      };
    }

    if (searchTerm) {
      filter.OR = [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { phone: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.studentProfile.findMany({
      where: filter,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        classSection: { include: { class: true, section: true } },
      },
      orderBy: { user: { name: 'asc' } },
      take: 200,
    });
  }

  /** Submits a new behavior case (complaint or praise). Enforces teacher identity and class-student boundaries. */
  async submitStudentBehavior(dto: CreateBehaviorDto) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;
    let teacherId = dto.teacherId;

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (!staffProfile) {
        throw new ForbiddenException('Teacher profile not found.');
      }

      // Enforce current teacher identity
      teacherId = staffProfile.id;

      // Check if student belongs to teacher's class roster
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: dto.studentId }
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
      const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
      const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

      if (!student.classSectionId || !classSectionIds.includes(student.classSectionId)) {
        throw new ForbiddenException('You do not have permission to log behavior for this student.');
      }
    } else {
      // Default fallback for admin if teacherId not specified
      if (!teacherId) {
        try {
          const current = await this.getCurrentTeacher();
          teacherId = (current as any).id;
        } catch {
          teacherId = undefined;
        }
      }
    }

    const priority = dto.behaviorType === 'Complaint' ? 'High' : 'Medium';
    return this.prisma.behaviorCase.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        teacherId,
        behaviorType: dto.behaviorType,
        category: dto.category,
        academicYear: dto.academicYear,
        status: 'New',
        priority,
        description: dto.description,
      },
    });
  }

  /** Returns academic years for the tenant. */
  async getAcademicYears() {
    const tenantId = this.getTenantId();
    return this.prisma.academicYear.findMany({ where: { tenantId }, orderBy: { name: 'desc' } });
  }

  /** Returns behavior cases scoped by user permissions. */
  async getPendingCases(academicYear?: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const filter: any = { tenantId };
    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (staffProfile) {
        const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
        const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
        const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

        filter.OR = [
          { teacherId: staffProfile.id },
          { student: { classSectionId: { in: classSectionIds } } }
        ];
      } else {
        return [];
      }
    }

    return this.prisma.behaviorCase.findMany({
      where: filter,
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            classSection: { include: { class: true, section: true } },
          },
        },
        teacher: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Returns cases for a specific student, enforcing permissions. */
  async getStudentCases(studentId: string, academicYear?: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const filter: any = { tenantId, studentId };
    if (academicYear) {
      filter.academicYear = academicYear;
    }

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (staffProfile) {
        const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
        const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
        const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

        filter.OR = [
          { teacherId: staffProfile.id },
          { student: { classSectionId: { in: classSectionIds } } }
        ];
      } else {
        return [];
      }
    }

    return this.prisma.behaviorCase.findMany({
      where: filter,
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            classSection: { include: { class: true, section: true } },
          },
        },
        teacher: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Updates the status of a case. Enforces admin-only permission. */
  async updateCaseStatus(caseId: string, dto: UpdateCaseStatusDto) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    if (user.role === 'TEACHER') {
      throw new ForbiddenException('Teachers are not authorized to change complaint status. This action is reserved for School Admins.');
    }

    const existing = await this.prisma.behaviorCase.findUnique({ where: { id: caseId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Case not found');
    }

    return this.prisma.behaviorCase.update({
      where: { id: caseId },
      data: { status: dto.status },
    });
  }

  /** Updates/Edits a behavior case. Enforces creator-ownership for teachers. */
  async updateBehavior(caseId: string, dto: CreateBehaviorDto) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const existing = await this.prisma.behaviorCase.findUnique({ where: { id: caseId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Case not found');
    }

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id }
      });
      if (!staffProfile || existing.teacherId !== staffProfile.id) {
        throw new ForbiddenException('You do not have permission to edit this complaint.');
      }
    }

    const priority = dto.behaviorType === 'Complaint' ? 'High' : 'Medium';
    return this.prisma.behaviorCase.update({
      where: { id: caseId },
      data: {
        studentId: dto.studentId,
        behaviorType: dto.behaviorType,
        category: dto.category,
        academicYear: dto.academicYear,
        description: dto.description,
        teacherId: dto.teacherId,
        priority,
      },
    });
  }

  /** Deletes a behavior case. Enforces creator-ownership for teachers. */
  async deleteBehavior(caseId: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const existing = await this.prisma.behaviorCase.findUnique({ where: { id: caseId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Case not found');
    }

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id }
      });
      if (!staffProfile || existing.teacherId !== staffProfile.id) {
        throw new ForbiddenException('You do not have permission to delete this complaint.');
      }
    }

    return this.prisma.behaviorCase.delete({
      where: { id: caseId },
    });
  }

  /** Returns simple statistics for a student – total cases, complaints, praises, and resolved. */
  async getStudentStats(studentId: string) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    if (user.role === 'TEACHER') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true } },
        },
      });

      if (staffProfile) {
        const advisorClassIds = staffProfile.classSections.map(cs => cs.id);
        const assignedClassIds = staffProfile.teacherAssignments.map(ta => ta.classSectionId);
        const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));

        const student = await this.prisma.studentProfile.findUnique({ where: { id: studentId } });
        if (!student || !student.classSectionId || !classSectionIds.includes(student.classSectionId)) {
          // If teacher doesn't teach student, return zero/empty stats or block
          return { studentId, totalCases: 0, complaintCount: 0, praiseCount: 0, resolvedCount: 0 };
        }
      } else {
        return { studentId, totalCases: 0, complaintCount: 0, praiseCount: 0, resolvedCount: 0 };
      }
    }

    const total = await this.prisma.behaviorCase.count({ where: { tenantId, studentId } });
    const complaintCount = await this.prisma.behaviorCase.count({
      where: { tenantId, studentId, behaviorType: 'Complaint' },
    });
    const praiseCount = await this.prisma.behaviorCase.count({
      where: { tenantId, studentId, behaviorType: 'Praise' },
    });
    const resolvedCount = await this.prisma.behaviorCase.count({
      where: { tenantId, studentId, status: 'Closed' },
    });
    return { studentId, totalCases: total, complaintCount, praiseCount, resolvedCount };
  }

  /** Returns parent complaints for the tenant (Admin view). */
  async getParentComplaints(statusFilter?: string) {
    const tenantId = this.getTenantId();
    const filter: any = { tenantId };
    if (statusFilter && statusFilter !== 'All') {
      filter.status = statusFilter;
    }

    const complaints = await this.prisma.complaint.findMany({
      where: filter,
      include: {
        submittedBy: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const complaintIds = complaints.map(c => c.id);
    const histories = await this.prisma.statusHistory.findMany({
      where: { entityType: 'COMPLAINT', entityId: { in: complaintIds } },
      include: { updatedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const historyMap = new Map<string, any[]>();
    for (const h of histories) {
      if (!historyMap.has(h.entityId)) historyMap.set(h.entityId, []);
      historyMap.get(h.entityId)!.push(h);
    }

    return complaints.map(c => ({
      ...c,
      statusHistories: historyMap.get(c.id) || [],
    }));
  }

  /** Updates status, admin reply, resolution notes for a parent complaint. */
  async updateParentComplaintStatus(complaintId: string, data: any) {
    const tenantId = this.getTenantId();
    const user = (this.request as any).user;

    const existing = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { submittedBy: true }
    });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Complaint not found');
    }

    const newStatus = data.status || existing.status;
    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: newStatus,
        adminReply: data.adminReply !== undefined ? data.adminReply : existing.adminReply,
        resolutionNotes: data.resolutionNotes !== undefined ? data.resolutionNotes : existing.resolutionNotes,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : existing.assignedToId,
      },
    });

    // Create StatusHistory record
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'COMPLAINT',
        entityId: complaintId,
        previousStatus: existing.status,
        currentStatus: newStatus,
        remarks: data.adminReply || data.resolutionNotes || `Status updated to ${newStatus}`,
        updatedById: user.id,
        tenantId,
      }
    }).catch(err => console.error('Failed to create status history for complaint:', err));

    // Send real-time notification to Parent
    if (existing.submittedById) {
      await this.prisma.notification.create({
        data: {
          title: `Complaint Ticket Updated`,
          message: `Your complaint "${existing.title}" is now ${newStatus}.${data.adminReply ? ' Admin Reply: ' + data.adminReply : ''}`,
          type: 'COMPLAINT_UPDATE',
          recipientId: existing.submittedById,
        }
      }).catch(err => console.error('Failed to notify parent of complaint update:', err));
    }

    return updated;
  }
}

