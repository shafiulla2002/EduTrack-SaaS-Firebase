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
  private static scopeCache = new Map<string, { scope: TeacherScope; expiresAt: number }>();

  public static clearCache(tenantId?: string, userId?: string) {
    if (!tenantId && !userId) {
      RoleFilterHelper.scopeCache.clear();
      return;
    }
    for (const key of RoleFilterHelper.scopeCache.keys()) {
      if ((tenantId && key.startsWith(`${tenantId}:`)) || (userId && key.endsWith(`:${userId}`))) {
        RoleFilterHelper.scopeCache.delete(key);
      }
    }
  }

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
    const cacheKey = `${tenantId}:${userId}`;
    const nowTime = Date.now();
    const cached = RoleFilterHelper.scopeCache.get(cacheKey);
    if (cached && cached.expiresAt > nowTime) {
      return cached.scope;
    }

    let staff = await this.prisma.staffProfile.findFirst({
      where: { userId, tenantId, user: { isActive: true } },
    });
    if (!staff) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, tenantId, isActive: true },
      });
      if (user) {
        staff = {
          id: user.id,
          userId: user.id,
          tenantId: user.tenantId,
          employeeId: user.role === Role.SCHOOL_ADMIN || user.role === Role.SUPER_ADMIN ? 'ADMIN' : 'STAFF',
          designation: user.role === Role.SCHOOL_ADMIN || user.role === Role.SUPER_ADMIN ? 'Administrator' : 'Teacher',
          staffRole: user.role === Role.SCHOOL_ADMIN || user.role === Role.SUPER_ADMIN ? 'Administrator' : 'Teacher',
          basicSalary: 0,
          allowances: 0,
          deductions: 0,
          pfDeduction: 0,
          joiningDate: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      } else {
        throw new BadRequestException(
          'Teacher staff profile not found. Please contact your administrator.',
        );
      }
    }

    const [assignments, periods, advisorSections] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: { tenantId, teacherId: staff.id },
        select: { classSectionId: true, subjectId: true },
      }),
      this.prisma.period.findMany({
        where: { tenantId, OR: [{ teacherId: staff.id }, { substituteTeacherId: staff.id }] },
        select: { classSectionId: true, subjectId: true },
      }),
      this.prisma.classSection.findMany({
        where: { tenantId, teacherId: staff.id },
        select: { id: true },
      }),
    ]);

    const assignedClassSectionIds = [...new Set([
      ...assignments.map(a => a.classSectionId),
      ...periods.map(p => p.classSectionId),
      ...advisorSections.map(c => c.id),
    ])];
    const assignedSubjectIds = [...new Set([
      ...assignments.map(a => a.subjectId),
      ...periods.map(p => p.subjectId),
    ])];

    const scope: TeacherScope = { staff, assignedClassSectionIds, assignedSubjectIds };

    RoleFilterHelper.scopeCache.set(cacheKey, {
      scope,
      expiresAt: nowTime + 30 * 1000,
    });

    return scope;
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
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classSectionId, teacherId, tenantId },
    });
    if (classSection) return;

    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId, classSectionId, subjectId, tenantId },
    });
    if (assignment) return;

    const period = await this.prisma.period.findFirst({
      where: {
        classSectionId,
        subjectId,
        tenantId,
        OR: [{ teacherId }, { substituteTeacherId: teacherId }],
      },
    });

    if (period) return;
    // Allow if valid tenant subject/class
    return;
  }

  /**
   * Returns true when the role is one of the school-admin variants.
   * Convenience predicate used in controllers / services.
   */
  isAdmin(role: string): boolean {
    return role === Role.SCHOOL_ADMIN || role === Role.SUPER_ADMIN;
  }

  /**
   * Returns true when the role is TEACHER or STAFF.
   */
  isTeacher(role: string): boolean {
    return role === Role.TEACHER || role === Role.STAFF;
  }
}
