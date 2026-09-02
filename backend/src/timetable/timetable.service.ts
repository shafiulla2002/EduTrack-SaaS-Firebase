import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PeriodTimingDto, SaveTimetablePeriodsDto, SaveSubstituteDto, SaveTimetableConfigDto } from './dto/timetable.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { TenantContext } from '../tenants/tenant.context';
import { RoleFilterHelper } from '../common/role-filter.helper';

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleFilterHelper: RoleFilterHelper,
  ) {}

  // Retrieve tenantId from the active AsyncLocalStorage context set by TenantMiddleware
  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found. Ensure X-Tenant-ID header or subdomain is provided.');
    }
    return tenantId;
  }

  /**
   * Returns the timetable periods for the authenticated teacher.
   * Uses RoleFilterHelper to resolve the teacher's staff profile.
   */
  async getMySchedule(userId: string, tenantId: string) {
    const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
    return this.getPeriodsForTeacher(scope.staff.id);
  }

  // ---------- Academic Years ----------
  async getAcademicYears() {
    const tenantId = this.getTenantId();
    let years = await this.prisma.academicYear.findMany({ where: { tenantId } });
    if (years.length === 0) {
      const defaultYear = await this.prisma.academicYear.create({
        data: {
          name: '2026-2027',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-04-30'),
          isActive: true,
          tenantId,
        },
      });
      years = [defaultYear];
    }
    return years;
  }

  // ---------- Classes ----------
  async getClasses(academicYearId?: string) {
    const tenantId = this.getTenantId();
    const whereClause: any = { tenantId, isActive: true };
    if (academicYearId) {
      whereClause.academicYearId = academicYearId;
    }
    return this.prisma.class.findMany({ where: whereClause });
  }

  async createClass(name: string, academicYearId?: string) {
    const tenantId = this.getTenantId();
    let targetYearId = academicYearId;
    if (!targetYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId },
        orderBy: { isActive: 'desc' },
      });
      if (!activeYear) {
        throw new NotFoundException('Please create an Academic Year first.');
      }
      targetYearId = activeYear.id;
    }
    return this.prisma.class.create({
      data: {
        name,
        academicYearId: targetYearId,
        tenantId,
      },
    });
  }

  async deleteClass(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.class.delete({ where: { id, tenantId } });
  }

  // ---------- Sections ----------
  async getSections() {
    const tenantId = this.getTenantId();
    return this.prisma.section.findMany({ where: { tenantId } });
  }

  async createSection(name: string) {
    const tenantId = this.getTenantId();
    return this.prisma.section.create({ data: { name, tenantId } });
  }

  async deleteSection(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.section.delete({ where: { id, tenantId } });
  }

  // ---------- Class Sections ----------
  async getClassSections() {
    const tenantId = this.getTenantId();
    return this.prisma.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true },
    });
  }

  async createClassSection(dto: any) {
    const tenantId = this.getTenantId();
    
    let classSection = await this.prisma.classSection.findUnique({
      where: {
        classId_sectionId: {
          classId: dto.classId,
          sectionId: dto.sectionId
        }
      }
    });

    if (classSection) {
      classSection = await this.prisma.classSection.update({
        where: { id: classSection.id },
        data: { strength: dto.classStrength ?? classSection.strength }
      });
      await this.prisma.teacherAssignment.deleteMany({
        where: { classSectionId: classSection.id, tenantId }
      });
      await this.prisma.classSubject.deleteMany({
        where: { classSectionId: classSection.id, tenantId }
      });

      const createAssigns = Object.entries(dto.subjectTeacherMap || {}).flatMap(([subjectId, teacherIds]) => {
        const ids = Array.isArray(teacherIds) ? teacherIds : [teacherIds];
        return ids.map((teacherId: string, index: number) => {
          const periodsVal = dto.subjectPeriodsMap && dto.subjectPeriodsMap[subjectId];
          const periods = Array.isArray(periodsVal) ? (periodsVal[index] ?? 5) : (periodsVal ?? 5);
          return {
            classSectionId: classSection.id,
            teacherId,
            subjectId,
            periodsPerWeek: Number(periods) || 5,
            tenantId
          };
        });
      });
      if (createAssigns.length > 0) {
        await this.prisma.teacherAssignment.createMany({ data: createAssigns });
      }

      const createSubjects = Object.keys(dto.subjectTeacherMap || {}).map((subjectId) => ({
        classSectionId: classSection.id,
        subjectId,
        tenantId
      }));
      if (createSubjects.length > 0) {
        await this.prisma.classSubject.createMany({ data: createSubjects });
      }
    } else {
      classSection = await this.prisma.classSection.create({
        data: {
          classId: dto.classId,
          sectionId: dto.sectionId,
          strength: dto.classStrength ?? 0,
          tenantId,
          teacherAssigns: {
            create: Object.entries(dto.subjectTeacherMap || {}).flatMap(([subjectId, teacherIds]) => {
              const ids = Array.isArray(teacherIds) ? teacherIds : [teacherIds];
              return ids.map((teacherId: string, index: number) => {
                const periodsVal = dto.subjectPeriodsMap && dto.subjectPeriodsMap[subjectId];
                const periods = Array.isArray(periodsVal) ? (periodsVal[index] ?? 5) : (periodsVal ?? 5);
                return {
                  teacherId,
                  subjectId,
                  periodsPerWeek: Number(periods) || 5,
                  tenantId,
                };
              });
            }),
          },
          classSubjects: {
            create: Object.keys(dto.subjectTeacherMap || {}).map((subjectId) => ({
              subjectId,
              tenantId,
            })),
          },
        },
      });
    }

    // Automatically create or update TeacherSkill records for all assigned teachers
    if (dto.subjectTeacherMap) {
      for (const [subjectId, teacherIds] of Object.entries(dto.subjectTeacherMap)) {
        const ids = Array.isArray(teacherIds) ? teacherIds : [teacherIds];
        for (const teacherId of ids) {
          if (!teacherId) continue;
          await this.prisma.teacherSkill.upsert({
            where: {
              teacherId_subjectId: {
                teacherId,
                subjectId,
              },
            },
            create: {
              teacherId,
              subjectId,
              skillLevel: 'Beginner',
              yearsOfExperience: 0,
              tenantId,
            },
            update: {},
          });
        }
      }
    }

    return classSection;
  }

  // ---------- Subjects ----------
  async getSubjects() {
    const tenantId = this.getTenantId();
    return this.prisma.subject.findMany({ where: { tenantId } });
  }

  async deleteSubject(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.subject.delete({ where: { id, tenantId } });
  }

  async createSubject(dto: any) {
    const tenantId = this.getTenantId();
    return this.prisma.subject.create({ data: { name: dto.name, tenantId } });
  }

  async bulkCreateSubjects(subjects: any[]) {
    const tenantId = this.getTenantId();
    const created: any[] = [];
    const skipped: any[] = [];
    for (const sub of subjects) {
      const existing = await this.prisma.subject.findFirst({ where: { name: sub.name, tenantId } });
      if (existing) {
        skipped.push(sub.name);
        continue;
      }
      const rec = await this.prisma.subject.create({ data: { name: sub.name, tenantId } });
      created.push(rec.name);
    }
    return { created: created.length, skipped: skipped.length };
  }

  // ---------- Class Section Subjects ----------
  async getSubjectsForClassSection(classSectionId: string) {
    const tenantId = this.getTenantId();
    const cs = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: { class: true, section: true },
    });
    if (!cs) throw new NotFoundException('Class section not found.');
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classSectionId, tenantId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });
    return classSubjects.map(cs => ({ subjectId: cs.subjectId, subjectName: cs.subject?.name ?? '' }));
  }

  // ---------- Teachers ----------
  async getAllTeachers() {
    const tenantId = this.getTenantId();
    return this.prisma.staffProfile.findMany({
      where: { tenantId },
      include: { user: true },
    });
  }

  async createTeacherWithSkills(dto: any) {
    const tenantId = this.getTenantId();
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();
    const emailLower = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash('StaffPass@123', 10);

    const existingUser = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const normalizedPhone = dto.phone && dto.phone.trim() ? dto.phone.replace(/\D/g, '').slice(-10) || null : null;
    if (normalizedPhone) {
      const existingPhone = await this.prisma.user.findFirst({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        throw new BadRequestException('Phone number already registered');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLower,
          name: fullName,
          passwordHash,
          role: Role.TEACHER,
          phone: normalizedPhone,
          tenantId,
        },
      });

      const teacher = await tx.staffProfile.create({
        data: {
          userId: user.id,
          employeeId: dto.employeeId,
          designation: dto.designation || 'Teacher',
          basicSalary: dto.basicSalary,
          allowances: dto.allowances,
          deductions: dto.deductions,
          pfDeduction: dto.pfDeduction,
          status: 'Active',
          qualification: dto.qualification,
          tenantId,
        },
      });

      if (dto.skills && Array.isArray(dto.skills)) {
        for (const skill of dto.skills) {
          if (!skill.subjectId) continue;
          await tx.teacherSkill.create({
            data: {
              teacherId: teacher.id,
              subjectId: skill.subjectId,
              skillLevel: skill.skillLevel,
              yearsOfExperience: skill.yearsOfExperience,
              tenantId,
            },
          });
        }
      }
      return teacher;
    });
  }

  async bulkCreateTeachers(teachers: any[]) {
    const tenantId = this.getTenantId();
    const created: any[] = [];
    const skipped: any[] = [];
    const passwordHash = await bcrypt.hash('StaffPass@123', 10);

    for (const t of teachers) {
      const emailLower = t.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });
      if (existing) {
        skipped.push(t.email);
        continue;
      }

      const normalizedPhone = t.phone && t.phone.trim() ? t.phone.replace(/\D/g, '').slice(-10) || null : null;
      if (normalizedPhone) {
        const existingPhone = await this.prisma.user.findFirst({ where: { phone: normalizedPhone } });
        if (existingPhone) {
          skipped.push(t.email);
          continue;
        }
      }

      const fullName = `${t.firstName} ${t.lastName}`.trim();
      try {
        const teacher = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: emailLower,
              name: fullName,
              passwordHash,
              role: Role.TEACHER,
              phone: normalizedPhone,
              tenantId,
            },
          });

          const prof = await tx.staffProfile.create({
            data: {
              userId: user.id,
              employeeId: t.employeeId,
              designation: t.designation || 'Teacher',
              basicSalary: t.basicSalary,
              allowances: t.allowances,
              deductions: t.deductions,
              pfDeduction: t.pfDeduction,
              status: 'Active',
              qualification: t.qualification,
              tenantId,
            },
          });

          if (t.skills && Array.isArray(t.skills)) {
            for (const skill of t.skills) {
              if (!skill.subjectId) continue;
              await tx.teacherSkill.create({
                data: {
                  teacherId: prof.id,
                  subjectId: skill.subjectId,
                  skillLevel: skill.skillLevel,
                  yearsOfExperience: skill.yearsOfExperience,
                  tenantId,
                },
              });
            }
          }
          return prof;
        });

        created.push(teacher.id);
      } catch (err: any) {
        console.error(`Failed to import teacher ${t.email}:`, err);
        skipped.push(t.email);
      }
    }
    return { created: created.length, skipped: skipped.length };
  }

  async getTeachersForSubject(subjectIds: string[]) {
    const tenantId = this.getTenantId();

    // Step 1: Find teachers who have a recorded TeacherSkill for any of the requested subjects
    const skills = await this.prisma.teacherSkill.findMany({
      where: { subjectId: { in: subjectIds }, tenantId },
      include: { teacher: { include: { user: true } } },
      distinct: ['teacherId', 'subjectId'],
    });

    // Step 2: Fetch ALL active teaching staff so we can fall back when skills are missing
    const allTeachers = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        user: { role: 'TEACHER', isActive: true },
      },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });

    const allTeacherOptions = allTeachers.map(t => ({
      Id: t.id,
      Name: t.user?.name ?? '',
      teacherId: t.id,
      teacherName: t.user?.name ?? '',
      skillLevel: 'Expert',
    }));

    // Step 3: Group skilled teachers per subject; fall back to ALL teachers when none skilled
    const bySubject: Record<string, any[]> = {};
    for (const subjectId of subjectIds) {
      const skilled = skills
        .filter(sk => sk.subjectId === subjectId)
        .map(sk => ({
          Id: sk.teacherId,
          Name: sk.teacher?.user?.name ?? '',
          teacherId: sk.teacherId,
          teacherName: sk.teacher?.user?.name ?? '',
          skillLevel: sk.skillLevel,
        }));
      // If no teacher has a recorded skill for this subject, show all active teachers
      bySubject[subjectId] = skilled.length > 0 ? skilled : allTeacherOptions;
    }
    return bySubject;
  }

  async getTeachersForSubjectInClass(subjectId: string, classSectionId: string) {
    const tenantId = this.getTenantId();

    // Find teachers who have a recorded TeacherSkill for this subject
    const skills = await this.prisma.teacherSkill.findMany({
      where: { subjectId, tenantId },
      include: { teacher: { include: { user: true } } },
      distinct: ['teacherId'],
    });

    if (skills.length > 0) {
      return skills.map(sk => ({
        Id: sk.teacherId,
        Name: sk.teacher?.user?.name ?? '',
        teacherId: sk.teacherId,
        teacherName: sk.teacher?.user?.name ?? '',
        skillLevel: sk.skillLevel,
      }));
    }

    // Fallback: return ALL active teaching staff so teacher dropdowns are never empty
    const allTeachers = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        user: { role: 'TEACHER', isActive: true },
      },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });

    return allTeachers.map(t => ({
      Id: t.id,
      Name: t.user?.name ?? '',
      teacherId: t.id,
      teacherName: t.user?.name ?? '',
      skillLevel: 'Expert',
    }));
  }

  // ---------- Period Timings ----------
  async getPeriodTimings() {
    const tenantId = this.getTenantId();
    let timings = await this.prisma.periodTiming.findMany({ where: { tenantId }, orderBy: { periodNumber: 'asc' } });
    if (timings.length === 0) {
      const defaultTimings = [
        { periodNumber: 1, name: 'P1', startTime: '09:00 AM', endTime: '10:00 AM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 2, name: 'P2', startTime: '10:00 AM', endTime: '11:00 AM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 3, name: 'P3', startTime: '11:00 AM', endTime: '12:00 PM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 4, name: 'P4', startTime: '12:00 PM', endTime: '01:00 PM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 5, name: 'P5', startTime: '01:00 PM', endTime: '02:00 PM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 6, name: 'P6', startTime: '02:00 PM', endTime: '03:00 PM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 7, name: 'P7', startTime: '03:00 PM', endTime: '04:00 PM', isBreak: false, isActive: true, tenantId },
        { periodNumber: 8, name: 'P8', startTime: '04:00 PM', endTime: '05:00 PM', isBreak: false, isActive: true, tenantId },
      ];
      await this.prisma.periodTiming.createMany({
        data: defaultTimings,
      });
      timings = await this.prisma.periodTiming.findMany({ where: { tenantId }, orderBy: { periodNumber: 'asc' } });
    }
    return timings;
  }

  async savePeriodTimings(dto: PeriodTimingDto[]) {
    const tenantId = this.getTenantId();
    // Simplistic approach: delete existing and recreate
    await this.prisma.periodTiming.deleteMany({ where: { tenantId } });
    const created = [];
    for (const pt of dto) {
      created.push(
        await this.prisma.periodTiming.create({
          data: {
            periodNumber: pt.periodNumber,
            name: pt.name || `P${pt.periodNumber}`,
            isBreak: pt.isBreak ?? false,
            startTime: pt.startTime,
            endTime: pt.endTime,
            isActive: true,
            tenantId
          },
        })
      );
    }
    return created;
  }

  // ---------- Timetable Periods ----------
  async getTimetableForClass(classSectionId: string, academicYearId: string, startDate?: string, endDate?: string) {
    const tenantId = this.getTenantId();
    const periods = await this.prisma.period.findMany({
      where: { classSectionId, tenantId },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        substituteTeacher: { include: { user: true } },
        periodTiming: true,
      },
    });

    // Return a flat array so the frontend can call .filter() / .forEach() on it
    return periods.map(p => ({
      periodId: p.id,
      day: p.dayOfWeek,
      periodNumber: p.periodTiming?.periodNumber ?? 0,
      subjectId: p.subjectId,
      subjectName: p.subject?.name ?? '—',
      teacherId: p.teacherId,
      teacherName: p.teacher?.user?.name ?? 'Unassigned',
      classSectionId: p.classSectionId ?? '',
      academicYearId: '',
      startTime: p.periodTiming?.startTime ?? '',
      endTime: p.periodTiming?.endTime ?? '',
      frequency: 'Weekly',
      isSubstitute: !!p.substituteTeacherId,
      substituteTeacherId: p.substituteTeacherId ?? null,
      substituteTeacherName: (p as any).substituteTeacher?.user?.name ?? null,
      originalTeacherName: p.teacher?.user?.name ?? null,
    }));
  }


  async saveTimetablePeriods(dto: SaveTimetablePeriodsDto) {
    const tenantId = this.getTenantId();
    // Remove existing periods for the classSection & academicYear (simple approach)
    await this.prisma.period.deleteMany({
      where: { classSectionId: dto.classSectionId, tenantId },
    });
    
    // Fetch all period timings in a single query
    const timings = await this.prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
    });
    const timingMap = new Map(timings.map(t => [t.periodNumber, t.id]));

    const periodsToCreate = [];
    for (const period of dto.periods) {
      const timingId = timingMap.get(period.periodNumber);
      if (!timingId) continue;
      periodsToCreate.push({
        classSectionId: dto.classSectionId,
        subjectId: period.subjectId,
        teacherId: period.teacherId,
        periodTimingId: timingId,
        dayOfWeek: period.day,
        tenantId,
      });
    }

    if (periodsToCreate.length > 0) {
      await this.prisma.period.createMany({
        data: periodsToCreate,
      });
    }
    return { success: true, count: periodsToCreate.length };
  }

  async saveSubstituteForPeriod(periodId: string, substituteTeacherId: string) {
    const tenantId = this.getTenantId();
    return this.prisma.period.update({
      where: { id: periodId, tenantId },
      data: { substituteTeacherId },
    });
  }

  // ---------- Workload & Assignments (implemented) ----------
  async getWorkloadSummary(academicYearId: string) {
    const tenantId = this.getTenantId();
    
    const teacherWhere: any = {
      tenantId,
      OR: [
        { user: { role: 'TEACHER' } },
        { designation: { contains: 'Teacher', mode: 'insensitive' } },
        { teacherSkills: { some: {} } },
      ],
    };

    const totalClassSections = await this.prisma.classSection.count({ where: { tenantId } });
    const totalTeachers = await this.prisma.staffProfile.count({ where: teacherWhere });
    const totalAssignments = await this.prisma.teacherAssignment.count({ where: { tenantId } });

    // Calculate avgLoadPercent (simple aggregation based on total periods scheduled vs standard load)
    const teachers = await this.prisma.staffProfile.findMany({
      where: teacherWhere,
      include: {
        _count: {
          select: { teacherAssignments: true }
        }
      }
    });
    let totalLoad = 0;
    for (const t of teachers) {
      totalLoad += Math.min(100, (t._count?.teacherAssignments || 0) * 15);
    }
    const avgLoadPercent = teachers.length > 0 ? Math.round(totalLoad / teachers.length) : 0;

    return {
      totalClassSections,
      totalTeachers,
      totalAssignments,
      avgLoadPercent,
    };
  }

  async getAllTeacherWorkloads() {
    const tenantId = this.getTenantId();
    const teachers = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        OR: [
          { user: { role: 'TEACHER' } },
          { designation: { contains: 'Teacher', mode: 'insensitive' } },
          { teacherSkills: { some: {} } },
        ],
      },
      include: {
        user: true,
        teacherAssignments: {
          select: {
            subjectId: true,
            classSectionId: true,
            periodsPerWeek: true,
          }
        },
        teacherSkills: {
          include: {
            subject: true
          }
        }
      }
    });

    return teachers.map(t => {
      const uniqueSubjects = new Set(t.teacherAssignments.map(a => a.subjectId));
      const uniqueClasses = new Set(t.teacherAssignments.map(a => a.classSectionId));
      const totalPeriods = t.teacherAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
      const loadPercent = Math.min(100, t.teacherAssignments.length * 15);
      const subjectsTaught = t.teacherSkills.map(sk => sk.subject?.name).filter(Boolean);

      return {
        teacherId: t.id,
        teacherName: t.user?.name || 'Unknown Teacher',
        subjectCount: uniqueSubjects.size,
        classCount: uniqueClasses.size,
        totalPeriods,
        loadPercent,
        subjectsTaught,
      };
    });
  }

  async getAllClassWorkloads() {
    const tenantId = this.getTenantId();
    const classSections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: {
        class: {
          include: {
            academicYear: true,
          }
        },
        section: true,
        classSubjects: true,
        teacherAssigns: true,
      }
    });

    return classSections.map(cs => {
      const subjectCount = cs.classSubjects.length;
      const staffedCount = cs.teacherAssigns.length;
      const loadPercent = subjectCount > 0 ? Math.round((staffedCount / subjectCount) * 100) : 0;

      return {
        classSectionId: cs.id,
        name: `${cs.class.name} - ${cs.section.name}`,
        academicYear: cs.class.academicYear?.name || '2026-2027',
        subjectCount,
        staffedCount,
        loadPercent,
      };
    });
  }

  async getTeacherWorkload(id: string) {
    const tenantId = this.getTenantId();
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId: id, tenantId },
      include: { subject: true, classSection: { include: { class: true, section: true } } },
    });

    // Group assignments by class section so the frontend can render classes -> subjects
    const classMap: Record<string, any> = {};
    for (const a of assignments) {
      const csId = a.classSectionId;
      if (!classMap[csId]) {
        classMap[csId] = {
          classSectionId: csId,
          className: a.classSection?.class?.name && a.classSection?.section?.name
            ? `${a.classSection.class.name} - ${a.classSection.section.name}`
            : 'Unknown Class',
          subjects: [],
        };
      }
      classMap[csId].subjects.push({
        assignmentId: a.id,
        subjectId: a.subjectId,
        subjectName: a.subject?.name || 'Unknown Subject',
        periodsPerWeek: a.periodsPerWeek || 5,
      });
    }

    return {
      classes: Object.values(classMap),
      totalAssignments: assignments.length,
    };
  }

  async getClassSectionWorkload(id: string) {
    const tenantId = this.getTenantId();

    // Fetch classSection with class, section, and academic year
    const classSection = await this.prisma.classSection.findFirst({
      where: { id, tenantId },
      include: {
        class: { include: { academicYear: true } },
        section: true,
      },
    });

    // Get class subjects
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classSectionId: id, tenantId },
      include: { subject: true },
    });

    const subjects = [];
    let totalTeachers = 0;
    for (const cs of classSubjects) {
      // Find assigned teachers from TeacherAssignment
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { classSectionId: id, subjectId: cs.subjectId, tenantId },
        include: {
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });

      const teachers = assignments.map(a => ({
        assignmentId: a.id,
        teacherId: a.teacherId,
        teacherName: a.teacher?.user?.name || 'Unknown Teacher',
        periodsPerWeek: a.periodsPerWeek || 5,
      }));

      if (teachers.length > 0) totalTeachers++;

      subjects.push({
        subjectId: cs.subjectId,
        subjectName: cs.subject?.name || 'Unknown Subject',
        teachers,
      });
    }

    const subjectCount = subjects.length;
    const loadPercent = subjectCount > 0 ? Math.round((totalTeachers / subjectCount) * 100) : 0;

    return {
      name: classSection
        ? `${classSection.class?.name || ''} - ${classSection.section?.name || ''}`
        : 'Unknown Class',
      academicYear: classSection?.class?.academicYear?.name || '2026-2027',
      subjectCount,
      teacherCount: totalTeachers,
      loadPercent,
      subjects,
    };
  }

  async updateTeacherAssignment(id: string, newTeacherId: string, periodsPerWeek: number) {
    const tenantId = this.getTenantId();
    const assignment = await this.prisma.teacherAssignment.update({
      where: { id, tenantId },
      data: { teacherId: newTeacherId, periodsPerWeek },
    });

    if (assignment.teacherId && assignment.subjectId) {
      await this.prisma.teacherSkill.upsert({
        where: {
          teacherId_subjectId: {
            teacherId: assignment.teacherId,
            subjectId: assignment.subjectId,
          },
        },
        create: {
          teacherId: assignment.teacherId,
          subjectId: assignment.subjectId,
          skillLevel: 'Beginner',
          yearsOfExperience: 0,
          tenantId,
        },
        update: {},
      });
    }

    return assignment;
  }

  async deleteTeacherAssignment(id: string) {
    const tenantId = this.getTenantId();
    return this.prisma.teacherAssignment.delete({ where: { id, tenantId } });
  }

  async getTeacherSkills(id: string) {
    const tenantId = this.getTenantId();
    const skills = await this.prisma.teacherSkill.findMany({
      where: { teacherId: id, tenantId },
      include: { subject: true },  // Include subject so we get the subject name
    });
    return skills.map(sk => ({
      id: sk.id,
      subjectId: sk.subjectId,
      subjectName: sk.subject?.name || 'Unknown Subject',
      skillLevel: sk.skillLevel,
      yearsOfExperience: sk.yearsOfExperience,
    }));
  }

  async getSkillLevelOptions() {
    return ['Beginner', 'Intermediate', 'Expert'];
  }

  async getPeriodsForTeacher(teacherId: string) {
    const tenantId = this.getTenantId();
    const periods = await this.prisma.period.findMany({
      where: { teacherId, tenantId },
      include: {
        subject: true,
        classSection: { include: { class: true, section: true } },
        periodTiming: true,
        substituteTeacher: { include: { user: true } },
      },
    });

    // Normalize to the exact shape the frontend expects
    return periods.map(p => ({
      periodId: p.id,
      day: p.dayOfWeek,                                             // frontend reads p.day
      periodNumber: p.periodTiming?.periodNumber ?? 0,
      subjectName: p.subject?.name ?? '—',
      className: p.classSection?.class?.name && p.classSection?.section?.name
        ? `${p.classSection.class.name} - ${p.classSection.section.name}`
        : '—',
      classSectionId: p.classSectionId ?? '',
      academicYearId: '',                                           // Period model has no academicYearId; keep empty string
      startTime: p.periodTiming?.startTime ?? '',
      endTime: p.periodTiming?.endTime ?? '',
      frequency: 'Weekly',
      isFreePeriod: false,
      substituteTeacherName: (p as any).substituteTeacher?.user?.name ?? null,
    }));
  }

  async getPeriodsForTeacherWithGaps(teacherId: string) {
    return this.getPeriodsForTeacher(teacherId);
  }

  async getLeaserPeriodsForTeacher(teacherId: string) {
    const tenantId = this.getTenantId();
    const periods = await this.prisma.period.findMany({
      where: { substituteTeacherId: teacherId, tenantId },
      include: {
        subject: true,
        classSection: { include: { class: true, section: true } },
        periodTiming: true,
      },
    });

    return periods.map(p => ({
      periodId: p.id,
      day: p.dayOfWeek,
      periodNumber: p.periodTiming?.periodNumber ?? 0,
      subjectName: p.subject?.name ?? '—',
      className: p.classSection?.class?.name && p.classSection?.section?.name
        ? `${p.classSection.class.name} - ${p.classSection.section.name}`
        : '—',
      classSectionId: p.classSectionId ?? '',
      startTime: p.periodTiming?.startTime ?? '',
      endTime: p.periodTiming?.endTime ?? '',
      frequency: 'Weekly',
      isLeaser: true,
      leaserType: 'LEASER',
    }));
  }

  // ---------- Timetable Configuration ----------
  async getTimetableConfig() {
    const tenantId = this.getTenantId();
    let config = await this.prisma.timetableConfig.findUnique({
      where: { tenantId }
    });
    if (!config) {
      // Return a default configuration if not saved yet
      config = await this.prisma.timetableConfig.create({
        data: {
          tenantId,
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          schoolStartTime: '09:00 AM',
          schoolEndTime: '04:00 PM',
          periodDuration: 45,
          autoGenerate: false,
          numPeriods: 8
        }
      });
    }
    return config;
  }

  async checkExistingTimetables() {
    const tenantId = this.getTenantId();
    const count = await this.prisma.period.count({
      where: { tenantId }
    });
    return { hasExistingTimetables: count > 0 };
  }

  async saveTimetableConfig(dto: SaveTimetableConfigDto) {
    const tenantId = this.getTenantId();

    // 1. Upsert TimetableConfig record
    const config = await this.prisma.timetableConfig.upsert({
      where: { tenantId },
      update: {
        workingDays: dto.workingDays,
        schoolStartTime: dto.schoolStartTime,
        schoolEndTime: dto.schoolEndTime,
        periodDuration: dto.periodDuration,
        autoGenerate: dto.autoGenerate,
        numPeriods: dto.numPeriods
      },
      create: {
        tenantId,
        workingDays: dto.workingDays,
        schoolStartTime: dto.schoolStartTime,
        schoolEndTime: dto.schoolEndTime,
        periodDuration: dto.periodDuration,
        autoGenerate: dto.autoGenerate,
        numPeriods: dto.numPeriods
      }
    });

    // 2. Clear old timings (which automatically cascades to delete associated Period timetable assignments)
    await this.prisma.periodTiming.deleteMany({ where: { tenantId } });

    // 3. Create the new PeriodTimings (teaching periods and breaks)
    const createdPeriods = [];
    for (const pt of dto.periods) {
      createdPeriods.push(
        await this.prisma.periodTiming.create({
          data: {
            periodNumber: pt.periodNumber,
            name: pt.name,
            isBreak: pt.isBreak ?? false,
            startTime: pt.startTime,
            endTime: pt.endTime,
            isActive: true,
            tenantId
          }
        })
      );
    }

    return { config, periods: createdPeriods };
  }
}

