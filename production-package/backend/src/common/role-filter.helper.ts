import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role } from '@prisma/client';

export interface TeacherScope {
  staff: { id: string; userId: string; tenantId: string };
  assignedClassSectionIds: string[];
  assignedSubjectIds: string[];
}

export interface AdminScope {
  tenantId: string;
}

/**
 * RoleFilterHelper
 *
 * Single source of truth for building role-based query scopes.
 * Used by AttendanceService, ExamsService, HomeworkService,
 * TimetableService, DashboardService (reports), and all future
 * academic modules.
 *
 * Architecture Rule: Do NOT duplicate these queries inside individual
 * services. Always call this helper.
 */
@Injectable()
export class RoleFilterHelper {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public scope builders ────────────────────────────────────────────────

  /**
   * Builds the teacher's query scope: their staff profile + all
   * classSectionIds and subjectIds from their TeacherAssignment records.
   *
   * Throws BadRequestException when the teacher profile is not found
   * (e.g. user exists but was not onboarded as a teacher).
   */
  async buildTeacherScope(userId: string, tenantId: string): Promise<TeacherScope> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { userId, tenantId, user: { isActive: true } },
    });
    if (!staff) {
      throw new BadRequestException(
        'Teacher staff profile not found. Please contact your administrator.',
      );
    }

    const [assignments, periods] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: { tenantId, teacherId: staff.id },
        select: { classSectionId: true, subjectId: true },
      }),
      this.prisma.period.findMany({
        where: { tenantId, teacherId: staff.id },
        select: { classSectionId: true, subjectId: true },
      }),
    ]);

    const assignedClassSectionIds = [...new Set([
      ...assignments.map(a => a.classSectionId),
      ...periods.map(p => p.classSectionId),
    ])];
    const assignedSubjectIds = [...new Set([
      ...assignments.map(a => a.subjectId),
      ...periods.map(p => p.subjectId),
    ])];

    return { staff, assignedClassSectionIds, assignedSubjectIds };
  }

  /**
   * Returns admin scope. Admins see everything within their tenant.
   * This is a pass-through, but using it makes the code explicit and
   * consistent with the teacher variant.
   */
  buildAdminScope(tenantId: string): AdminScope {
    return { tenantId };
  }

  /**
   * Verifies that a specific teacher is assigned to teach a subject in a
   * given class-section. Throws if the assignment does not exist.
   *
   * Used before allowing a teacher to POST marks, save homework, etc.
   */
  async validateTeacherAssignment(
    teacherId: string,
    classSectionId: string,
    subjectId: string,
    tenantId: string,
  ): Promise<void> {
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId, classSectionId, subjectId, tenantId },
    });
    if (assignment) return;

    const period = await this.prisma.period.findFirst({
      where: { teacherId, classSectionId, subjectId, tenantId },
    });

    if (!period) {
      throw new BadRequestException(
        'You do not have teaching permissions for this class and subject combination.',
      );
    }
  }

  /**
   * Returns true when the role is one of the school-admin variants.
   * Convenience predicate used in controllers / services.
   */
  isAdmin(role: string): boolean {
    return role === Role.SCHOOL_ADMIN || role === Role.SUPER_ADMIN;
  }

  /**
   * Returns true when the role is TEACHER.
   */
  isTeacher(role: string): boolean {
    return role === Role.TEACHER;
  }
}
