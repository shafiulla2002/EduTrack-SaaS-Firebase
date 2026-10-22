import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  // ACADEMIC YEARS
  async getAcademicYears(tenantId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
  }

  // CLASSES
  async getClasses(tenantId: string) {
    return this.prisma.class.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createClass(tenantId: string, name: string) {
    if (!name) throw new BadRequestException('Class Name is required.');

    const existing = await this.prisma.class.findFirst({
      where: { tenantId, name },
    });
    if (existing) {
      throw new BadRequestException(`A class named "${name}" already exists.`);
    }

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!activeYear) {
      throw new BadRequestException('No active academic year found.');
    }

    return this.prisma.class.create({
      data: {
        id: randomUUID(),
        name,
        tenantId,
        academicYearId: activeYear.id,
        isActive: true,
      },
    });
  }

  async deleteClass(tenantId: string, classId: string) {
    const linked = await this.prisma.classSection.findFirst({
      where: { classId },
    });
    if (linked) {
      throw new BadRequestException('Cannot delete this class because it is linked to one or more class sections.');
    }

    return this.prisma.class.delete({
      where: { id: classId },
    });
  }

  // SECTIONS
  async getSections(tenantId: string) {
    return this.prisma.section.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSection(tenantId: string, name: string) {
    if (!name) throw new BadRequestException('Section Name is required.');

    const existing = await this.prisma.section.findFirst({
      where: { tenantId, name },
    });
    if (existing) {
      throw new BadRequestException(`A section named "${name}" already exists.`);
    }

    return this.prisma.section.create({
      data: {
        id: randomUUID(),
        name,
        tenantId,
        isActive: true,
      },
    });
  }

  async deleteSection(tenantId: string, sectionId: string) {
    const linked = await this.prisma.classSection.findFirst({
      where: { sectionId },
    });
    if (linked) {
      throw new BadRequestException('Cannot delete this section because it is linked to one or more class sections.');
    }

    return this.prisma.section.delete({
      where: { id: sectionId },
    });
  }

  // PERIOD TIMINGS
  async getPeriodTimings(tenantId: string) {
    const list = await this.prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });
    return list.map(pt => ({
      id: pt.id,
      num: pt.periodNumber,
      label: `Period ${pt.periodNumber}`,
      startTime: pt.startTime,
      endTime: pt.endTime,
      timeLabel: `${pt.startTime}${pt.endTime ? ' – ' + pt.endTime : ''}`,
    }));
  }

  async savePeriodTimings(tenantId: string, timings: any[]) {
    // Validate inputs
    for (const t of timings) {
      if (!t.periodNumber || !t.startTime || !t.endTime) {
        throw new BadRequestException('Invalid period timing data');
      }
    }

    // Wrap in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Find existing timings to update or delete
      const existing = await tx.periodTiming.findMany({
        where: { tenantId },
      });

      const incomingIds = timings.filter(t => t.id).map(t => t.id);
      const toDelete = existing.filter(e => !incomingIds.includes(e.id));

      // Delete removed timings
      if (toDelete.length > 0) {
        await tx.periodTiming.deleteMany({
          where: { id: { in: toDelete.map(d => d.id) } },
        });
      }

      // Upsert timings
      const results = [];
      for (const t of timings) {
        if (t.id) {
          results.push(
            await tx.periodTiming.update({
              where: { id: t.id },
              data: {
                periodNumber: Number(t.periodNumber),
                startTime: t.startTime,
                endTime: t.endTime,
              },
            }),
          );
        } else {
          results.push(
            await tx.periodTiming.create({
              data: {
                id: randomUUID(),
                tenantId,
                periodNumber: Number(t.periodNumber),
                startTime: t.startTime,
                endTime: t.endTime,
                isActive: true,
              },
            }),
          );
        }
      }
      return results;
    });
  }

  // SUBJECTS
  async getSubjects(tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(tenantId: string, data: { name: string; code?: string; description?: string }) {
    if (!data.name) throw new BadRequestException('Subject Name is required.');

    const existing = await this.prisma.subject.findFirst({
      where: { tenantId, name: data.name, isActive: true },
    });
    if (existing) {
      throw new BadRequestException(`A subject with the name "${data.name}" already exists.`);
    }

    return this.prisma.subject.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: data.name,
        isActive: true,
      },
    });
  }

  async bulkCreateSubjects(tenantId: string, subjectsData: any[]) {
    if (!subjectsData || subjectsData.length === 0) {
      throw new BadRequestException('No subject data provided.');
    }

    const activeSubjects = await this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
    });
    const existingNames = new Set(activeSubjects.map(s => s.name.toLowerCase()));

    const skipped: string[] = [];
    const errorDetails: string[] = [];
    let created = 0;

    for (let i = 0; i < subjectsData.length; i++) {
      const row = subjectsData[i];
      const name = row.name ? row.name.trim() : '';

      if (!name) {
        errorDetails.push(`Row ${i + 1}: Subject name is required.`);
        continue;
      }

      if (existingNames.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }

      try {
        await this.prisma.subject.create({
          data: {
            id: randomUUID(),
            tenantId,
            name,
            isActive: true,
          },
        });
        created++;
        existingNames.add(name.toLowerCase());
      } catch (err: any) {
        errorDetails.push(`${name}: ${err.message}`);
      }
    }

    return {
      created,
      skipped: skipped.length,
      errors: errorDetails.length,
      errorDetails,
      skippedNames: skipped,
    };
  }

  // TEACHERS FOR SUBJECTS
  async getTeachersForSubject(tenantId: string, subjectIds: string[]) {
    if (!subjectIds || subjectIds.length === 0) return {};

    const skills = await this.prisma.teacherSkill.findMany({
      where: {
        tenantId,
        subjectId: { in: subjectIds },
      },
      include: {
        StaffProfile: {
          include: { User: true },
        },
      },
      orderBy: {
        StaffProfile: {
          User: { name: 'asc' },
        },
      },
    });

    const result: Record<string, any[]> = {};
    for (const ts of skills) {
      if (!result[ts.subjectId]) {
        result[ts.subjectId] = [];
      }
      result[ts.subjectId].push({
        Id: ts.StaffProfile.id,
        Name: ts.StaffProfile.User.name,
        Teacher_Skill__c: ts.skillLevel || 'Expert',
      });
    }
    return result;
  }

  // CREATE TEACHER WITH SKILLS
  async createTeacherWithSkills(tenantId: string, data: any) {
    if (!data.firstName || !data.lastName) {
      throw new BadRequestException('First Name and Last Name are required.');
    }
    if (!data.email) {
      throw new BadRequestException('Email is required.');
    }
    if (!data.skills || data.skills.length === 0) {
      throw new BadRequestException('At least one subject skill is required.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash('Welcome2026!', 10);
    const userId = randomUUID();
    const teacherId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // 1. Create User
      await tx.user.create({
        data: {
          id: userId,
          email: data.email,
          passwordHash: hashedPassword,
          name: `${data.firstName} ${data.lastName}`,
          role: 'TEACHER',
          phone: data.phone || null,
          isActive: true,
          tenantId,
          updatedAt: new Date(),
        },
      });

      // 2. Create StaffProfile
      const teacher = await tx.staffProfile.create({
        data: {
          id: teacherId,
          userId,
          employeeId: data.employeeId || null,
          designation: data.designation || null,
          qualification: data.qualification || null,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
          status: data.staffStatus || 'Active',
          basicSalary: data.basicSalary || null,
          allowances: data.allowances || null,
          deductions: data.deductions || null,
          pfDeduction: data.pfDeduction || null,
          subjectsTaught: data.skills.map((s: any) => s.subjectId),
        },
      });

      // 3. Create Skills
      const skillRecords = data.skills.map((s: any) => ({
        id: randomUUID(),
        tenantId,
        teacherId,
        subjectId: s.subjectId,
        skillLevel: s.skillLevel,
        yearsOfExperience: s.yearsOfExperience || 0,
      }));

      if (skillRecords.length > 0) {
        await tx.teacherSkill.createMany({
          data: skillRecords,
        });
      }

      return {
        teacherId,
        teacherName: `${data.firstName} ${data.lastName}`,
        skillsCount: skillRecords.length,
      };
    });
  }

  // BULK CREATE TEACHERS
  async bulkCreateTeachers(tenantId: string, teachersData: any[]) {
    if (!teachersData || teachersData.length === 0) {
      throw new BadRequestException('No teacher data provided.');
    }

    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
    });
    const subjectNameToId: Record<string, string> = {};
    for (const s of subjects) {
      subjectNameToId[s.name.toLowerCase().trim()] = s.id;
    }

    const incomingEmails = teachersData.filter(t => t.email).map(t => t.email.trim().toLowerCase());
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: incomingEmails } },
    });
    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

    const skipped: string[] = [];
    const errorDetails: string[] = [];
    let created = 0;
    let skillsCreated = 0;

    const hashedPassword = await bcrypt.hash('Welcome2026!', 10);

    for (let i = 0; i < teachersData.length; i++) {
      const row = teachersData[i];
      const firstName = row.firstName ? row.firstName.trim() : '';
      const lastName = row.lastName ? row.lastName.trim() : '';
      const email = row.email ? row.email.trim() : '';

      if (!firstName || !lastName || !email) {
        errorDetails.push(`Row ${i + 1}: Name and Email are required.`);
        continue;
      }

      if (existingEmails.has(email.toLowerCase())) {
        skipped.push(`${firstName} ${lastName} (${email})`);
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const userId = randomUUID();
          const teacherId = randomUUID();

          // 1. Create User
          await tx.user.create({
            data: {
              id: userId,
              email,
              passwordHash: hashedPassword,
              name: `${firstName} ${lastName}`,
              role: 'TEACHER',
              phone: row.phone || null,
              isActive: true,
              tenantId,
              updatedAt: new Date(),
            },
          });

          // 2. Create StaffProfile
          await tx.staffProfile.create({
            data: {
              id: teacherId,
              userId,
              employeeId: row.employeeId || null,
              designation: row.designation || null,
              qualification: row.qualification || null,
              joiningDate: row.joiningDate ? new Date(row.joiningDate) : null,
              status: 'Active',
              basicSalary: row.basicSalary || null,
              allowances: row.allowances || null,
              deductions: row.deductions || null,
              pfDeduction: row.pf || null,
            },
          });

          // 3. Process skills from row keys
          const skillRecords = [];
          for (let skillIdx = 1; skillIdx <= 3; skillIdx++) {
            const subKey = `subject${skillIdx}`;
            const lvlKey = `skillLevel${skillIdx}`;
            if (row[subKey] && row[subKey].trim()) {
              const subName = row[subKey].trim();
              const subjectId = subjectNameToId[subName.toLowerCase()];
              if (subjectId) {
                skillRecords.push({
                  id: randomUUID(),
                  tenantId,
                  teacherId,
                  subjectId,
                  skillLevel: row[lvlKey] || 'Expert',
                  yearsOfExperience: 0,
                });
              }
            }
          }

          if (skillRecords.length > 0) {
            await tx.teacherSkill.createMany({
              data: skillRecords,
            });
            skillsCreated += skillRecords.length;
          }
        });
        created++;
        existingEmails.add(email.toLowerCase());
      } catch (err: any) {
        errorDetails.push(`${firstName} ${lastName}: ${err.message}`);
      }
    }

    return {
      created,
      skipped: skipped.length,
      errors: errorDetails.length,
      errorDetails,
      skippedNames: skipped,
      skillsCreated,
    };
  }

  // WORKLOAD SUMMARY
  async getWorkloadSummary(tenantId: string, academicYearId?: string) {
    const activeYear = academicYearId
      ? await this.prisma.academicYear.findUnique({ where: { id: academicYearId } })
      : await this.prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });

    if (!activeYear) return { totalClassSections: 0, totalTeachers: 0, totalAssignments: 0, avgLoadPercent: 0 };

    // Find classSections linked to classes in this academic year
    const sections = await this.prisma.classSection.findMany({
      where: {
        tenantId,
        Class: { academicYearId: activeYear.id },
      },
    });
    const sectionIds = sections.map(s => s.id);

    const totalClassSections = sections.length;

    // Find TeacherAssignments in these sections
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        classSectionId: { in: sectionIds },
      },
    });

    const totalAssignments = assignments.length;
    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));
    const totalTeachers = uniqueTeachers.size;

    let avgLoadPercent = 0;
    if (totalTeachers > 0 && totalAssignments > 0) {
      // Estimate load per teacher (average assignments divided by standard load)
      avgLoadPercent = Math.min(Math.round((totalAssignments / totalTeachers / 8) * 100), 100);
    }

    return {
      totalClassSections,
      totalTeachers,
      totalAssignments,
      avgLoadPercent,
    };
  }

  // GET ALL TEACHER WORKLOADS
  async getAllTeacherWorkloads(tenantId: string) {
    const teachers = await this.prisma.staffProfile.findMany({
      where: { User: { tenantId, role: 'TEACHER' } },
      include: { User: true },
      orderBy: { User: { name: 'asc' } },
    });

    const periodCounts = await this.prisma.period.groupBy({
      by: ['teacherId'],
      where: { tenantId, teacherId: { not: null } },
      _count: { id: true },
    });
    const periodCountMap = new Map(periodCounts.map(pc => [pc.teacherId, pc._count.id]));

    const uniqueSubjects = await this.prisma.period.findMany({
      where: { tenantId, teacherId: { not: null } },
      select: { teacherId: true, subjectId: true },
      distinct: ['teacherId', 'subjectId'],
    });
    const subjectCountMap = new Map<string, number>();
    for (const us of uniqueSubjects) {
      if (us.teacherId) {
        subjectCountMap.set(us.teacherId, (subjectCountMap.get(us.teacherId) || 0) + 1);
      }
    }

    const uniqueClasses = await this.prisma.period.findMany({
      where: { tenantId, teacherId: { not: null } },
      select: { teacherId: true, classSectionId: true },
      distinct: ['teacherId', 'classSectionId'],
    });
    const classCountMap = new Map<string, number>();
    for (const uc of uniqueClasses) {
      if (uc.teacherId) {
        classCountMap.set(uc.teacherId, (classCountMap.get(uc.teacherId) || 0) + 1);
      }
    }

    const MAX_WEEKLY_PERIODS = 48;

    return teachers.map((t) => {
      const totalPeriods = periodCountMap.get(t.id) || 0;
      const subjectCount = subjectCountMap.get(t.id) || 0;
      const classCount = classCountMap.get(t.id) || 0;
      const loadPercent = Math.min(Math.round((totalPeriods / MAX_WEEKLY_PERIODS) * 100), 100);

      return {
        teacherId: t.id,
        teacherName: t.User.name,
        subjectCount,
        classCount,
        totalPeriods,
        loadPercent,
      };
    });
  }

  // GET ALL CLASS WORKLOADS
  async getAllClassWorkloads(tenantId: string) {
    const sections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: {
        Class: { include: { AcademicYear: true } },
        Section: true,
      },
      orderBy: { Class: { name: 'asc' } },
    });

    const classSubjects = await this.prisma.classSubject.groupBy({
      by: ['classSectionId'],
      where: { tenantId },
      _count: { id: true },
    });
    const subjectCountMap = new Map(classSubjects.map(cs => [cs.classSectionId, cs._count.id]));

    const staffed = await this.prisma.teacherAssignment.groupBy({
      by: ['classSectionId'],
      where: { tenantId },
      _count: { subjectId: true },
    });
    const staffedCountMap = new Map(staffed.map(s => [s.classSectionId, s._count.subjectId]));

    return sections.map((cs) => {
      const totalSubjects = subjectCountMap.get(cs.id) || 0;
      const staffedSubjects = staffedCountMap.get(cs.id) || 0;
      const loadPercent = totalSubjects > 0 ? Math.round((staffedSubjects / totalSubjects) * 100) : 0;

      return {
        classSectionId: cs.id,
        name: `${cs.Class.name} - ${cs.Section.name}`,
        academicYear: cs.Class.AcademicYear.name,
        subjectCount: totalSubjects,
        staffedCount: staffedSubjects,
        loadPercent,
      };
    });
  }

  // GET DETAILED WORKLOAD FOR TEACHER
  async getTeacherWorkload(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.staffProfile.findUnique({
      where: { id: teacherId },
      include: { User: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found.');

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId, tenantId },
      include: {
        ClassSection: {
          include: { Class: { include: { AcademicYear: true } }, Section: true },
        },
        Subject: true,
      },
      orderBy: [
        { ClassSection: { Class: { name: 'asc' } } },
        { Subject: { name: 'asc' } },
      ],
    });

    // Count periods scheduled for this teacher in periods grid
    const periods = await this.prisma.period.groupBy({
      by: ['classSectionId', 'subjectId'],
      where: { tenantId, teacherId },
      _count: { id: true },
    });
    const periodCountMap = new Map<string, number>();
    for (const p of periods) {
      periodCountMap.set(`${p.classSectionId}|${p.subjectId}`, p._count.id);
    }

    const bySection: Record<string, any[]> = {};
    for (const ta of assignments) {
      const secId = ta.classSectionId;
      if (!bySection[secId]) bySection[secId] = [];
      bySection[secId].push(ta);
    }

    const classes = [];
    for (const secId in bySection) {
      const list = bySection[secId];
      const first = list[0];

      const subjects = list.map((ta) => {
        const countKey = `${ta.classSectionId}|${ta.subjectId}`;
        const timetableCount = periodCountMap.get(countKey);
        const periodsPerWeek = timetableCount !== undefined ? timetableCount : ta.periodsPerWeek;

        return {
          assignmentId: ta.id,
          subjectId: ta.subjectId,
          subjectName: ta.Subject.name,
          periodsPerWeek,
          fromTimetable: timetableCount !== undefined,
        };
      });

      classes.push({
        classSectionId: secId,
        className: `${first.ClassSection.Class.name} - ${first.ClassSection.Section.name}`,
        academicYear: first.ClassSection.Class.AcademicYear.name,
        subjects,
      });
    }

    return {
      teacherName: teacher.User.name,
      classes,
    };
  }

  // GET DETAILED WORKLOAD FOR CLASS SECTION
  async getClassSectionWorkload(tenantId: string, classSectionId: string) {
    const cs = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: {
        Class: { include: { AcademicYear: true } },
        Section: true,
      },
    });
    if (!cs) throw new NotFoundException('Class section not found.');

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classSectionId, tenantId },
      include: { Subject: true },
      orderBy: { Subject: { name: 'asc' } },
    });

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { classSectionId, tenantId },
      include: { StaffProfile: { include: { User: true } } },
    });

    const periodCounts = await this.prisma.period.groupBy({
      by: ['subjectId', 'teacherId'],
      where: { classSectionId, tenantId, teacherId: { not: null } },
      _count: { id: true },
    });
    const periodCountMap = new Map<string, number>();
    for (const pc of periodCounts) {
      periodCountMap.set(`${pc.subjectId}|${pc.teacherId}`, pc._count.id);
    }

    const bySubject: Record<string, any[]> = {};
    for (const a of assignments) {
      if (!bySubject[a.subjectId]) bySubject[a.subjectId] = [];
      bySubject[a.subjectId].push(a);
    }

    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));

    const subjects = classSubjects.map((csub) => {
      const teachersList = bySubject[csub.subjectId] || [];
      const teachers = teachersList.map((ta) => {
        const countKey = `${ta.subjectId}|${ta.teacherId}`;
        const timetableCount = periodCountMap.get(countKey);
        const periodsPerWeek = timetableCount !== undefined ? timetableCount : ta.periodsPerWeek;

        return {
          teacherId: ta.teacherId,
          teacherName: ta.StaffProfile.User.name,
          assignmentId: ta.id,
          periodsPerWeek,
          fromTimetable: timetableCount !== undefined,
        };
      });

      return {
        subjectId: csub.subjectId,
        subjectName: csub.Subject.name,
        teachers,
      };
    });

    return {
      name: `${cs.Class.name} - ${cs.Section.name}`,
      academicYear: cs.Class.AcademicYear.name,
      teacherCount: uniqueTeachers.size,
      subjects,
    };
  }

  // UPDATE TEACHER ASSIGNMENT
  async updateTeacherAssignment(tenantId: string, id: string, newTeacherId?: string, periodsPerWeek?: number) {
    const ta = await this.prisma.teacherAssignment.findUnique({
      where: { id },
    });
    if (!ta) throw new NotFoundException('Assignment not found.');

    const data: any = {};
    if (newTeacherId) {
      data.teacherId = newTeacherId;
    }
    if (periodsPerWeek !== undefined) {
      data.periodsPerWeek = periodsPerWeek;
    }

    return this.prisma.teacherAssignment.update({
      where: { id },
      data,
    });
  }

  // DELETE TEACHER ASSIGNMENT
  async deleteTeacherAssignment(tenantId: string, id: string) {
    return this.prisma.teacherAssignment.delete({
      where: { id },
    });
  }

  // CREATE CLASS SECTION (JUNCTION)
  async createClassSection(tenantId: string, data: any) {
    const existing = await this.prisma.classSection.findFirst({
      where: {
        tenantId,
        classId: data.classId,
        sectionId: data.sectionId,
      },
    });
    if (existing) {
      throw new BadRequestException('This Class and Section combination already exists.');
    }

    return this.prisma.$transaction(async (tx) => {
      const classSectionId = randomUUID();

      // 1. Create ClassSection
      await tx.classSection.create({
        data: {
          id: classSectionId,
          tenantId,
          classId: data.classId,
          sectionId: data.sectionId,
          strength: data.classStrength || 0,
        },
      });

      // 2. Create ClassSubjects
      const subjects = Object.keys(data.subjectTeacherMap);
      const classSubjectRecords = subjects.map((subId) => ({
        id: randomUUID(),
        tenantId,
        classSectionId,
        subjectId: subId,
      }));
      if (classSubjectRecords.length > 0) {
        await tx.classSubject.createMany({
          data: classSubjectRecords,
        });
      }

      // 3. Create TeacherAssignments
      const assignments = [];
      for (const subId of subjects) {
        const teacherIds = data.subjectTeacherMap[subId] || [];
        const periodsList = data.subjectPeriodsMap?.[subId] || [];

        for (let i = 0; i < teacherIds.length; i++) {
          const tId = teacherIds[i];
          const periods = periodsList[i] !== undefined ? Number(periodsList[i]) : 5;

          assignments.push({
            id: randomUUID(),
            tenantId,
            classSectionId,
            subjectId: subId,
            teacherId: tId,
            periodsPerWeek: periods,
          });
        }
      }

      if (assignments.length > 0) {
        await tx.teacherAssignment.createMany({
          data: assignments,
        });
      }

      return {
        classSectionId,
        subjectCount: classSubjectRecords.length,
        teacherAssignmentCount: assignments.length,
      };
    });
  }

  // GET ALL CLASS SECTIONS
  async getAllClassSections(tenantId: string) {
    const sections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: {
        Class: true,
        Section: true,
      },
      orderBy: [
        { Class: { name: 'asc' } },
        { Section: { name: 'asc' } },
      ],
    });

    return sections.map((s) => ({
      Id: s.id,
      Name: `${s.Class.name} - ${s.Section.name}`,
      className: s.Class.name,
      sectionName: s.Section.name,
      academicYear: '',
      classId: s.classId,
    }));
  }

  // GET ALL TEACHERS
  async getAllTeachers(tenantId: string) {
    const list = await this.prisma.staffProfile.findMany({
      where: { User: { tenantId, role: 'TEACHER' } },
      include: { User: true },
      orderBy: { User: { name: 'asc' } },
    });
    return list.map(t => ({ Id: t.id, Name: t.User.name }));
  }

  // GET TIMETABLE FOR CLASS
  async getTimetableForClass(
    tenantId: string,
    classSectionId: string,
    academicYearId: string,
    startDate?: string,
    endDate?: string
  ) {
    // Find all periods scheduled for this section
    const periods = await this.prisma.period.findMany({
      where: {
        classSectionId,
        tenantId,
      },
      include: {
        Subject: true,
        StaffProfile_Period_teacherIdToStaffProfile: { include: { User: true } },
        StaffProfile_Period_substituteTeacherIdToStaffProfile: { include: { User: true } },
      },
    });

    const result: Record<string, any> = {};

    for (const p of periods) {
      const key = `${p.dayOfWeek}_${p.periodTimingId}`;

      const regularTeacherId = p.teacherId;
      const regularTeacherName = p.StaffProfile_Period_teacherIdToStaffProfile?.User?.name || 'Unassigned';

      let isOnLeave = false;
      let onLeaveTeacherName = null;
      let substituteTeacherIdStr = null;
      let substituteTeacherName = null;

      if (p.substituteTeacherId) {
        isOnLeave = true;
        onLeaveTeacherName = regularTeacherName;
        substituteTeacherIdStr = p.substituteTeacherId;
        substituteTeacherName = p.StaffProfile_Period_substituteTeacherIdToStaffProfile?.User?.name || null;
      }

      result[key] = {
        periodId: p.id,
        subjectId: p.subjectId,
        subjectName: p.Subject?.name || '—',
        teacherId: isOnLeave ? substituteTeacherIdStr : regularTeacherId,
        teacherName: isOnLeave ? substituteTeacherName : regularTeacherName,
        regularTeacherId,
        isOnLeave,
        onLeaveTeacherName,
        substituteTeacherId: substituteTeacherIdStr,
        substituteTeacherName,
      };
    }

    return result;
  }

  // LEASER PERIODS (TEACHER ON LEAVE / SUBSTITUTED)
  async getLeaserPeriodsForTeacher(tenantId: string, teacherId: string) {
    const list = await this.prisma.period.findMany({
      where: {
        tenantId,
        substituteTeacherId: teacherId,
      },
      select: { id: true },
    });
    return list.map(item => item.id);
  }

  // GET PERIODS FOR TEACHER
  async getPeriodsForTeacher(tenantId: string, teacherId: string): Promise<any[]> {
    const periods = await this.prisma.period.findMany({
      where: {
        tenantId,
        OR: [
          { teacherId },
          { substituteTeacherId: teacherId },
        ],
      },
      include: {
        ClassSection: {
          include: { Class: true, Section: true },
        },
        Subject: true,
        PeriodTiming: true,
        StaffProfile_Period_teacherIdToStaffProfile: { include: { User: true } },
        StaffProfile_Period_substituteTeacherIdToStaffProfile: { include: { User: true } },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { PeriodTiming: { periodNumber: 'asc' } },
      ],
    });

    return periods.map((p) => {
      const isSubbed = p.substituteTeacherId === teacherId;
      const regularTeacherName = p.StaffProfile_Period_teacherIdToStaffProfile?.User?.name || 'Unassigned';
      const substituteTeacherName = p.StaffProfile_Period_substituteTeacherIdToStaffProfile?.User?.name || null;

      return {
        periodId: p.id,
        day: p.dayOfWeek,
        periodNumber: p.PeriodTiming.periodNumber,
        classSectionId: p.classSectionId,
        className: `${p.ClassSection.Class.name} - ${p.ClassSection.Section.name}`,
        academicYear: p.ClassSection.Class.academicYearId,
        startTime: p.PeriodTiming.startTime,
        endTime: p.PeriodTiming.endTime,
        subjectId: p.subjectId,
        subjectName: p.Subject.name,
        isLeaser: isSubbed,
        isSubstitute: !!p.substituteTeacherId,
        substituteTeacherId: p.substituteTeacherId,
        substituteTeacherName,
        originalTeacherName: regularTeacherName,
        teacherId: isSubbed ? p.substituteTeacherId : p.teacherId,
        teacherName: isSubbed ? substituteTeacherName : regularTeacherName,
      };
    });
  }

  // GET PERIODS FOR TEACHER WITH GAPS
  async getPeriodsForTeacherWithGaps(tenantId: string, teacherId: string): Promise<any[]> {
    const actualPeriods = await this.getPeriodsForTeacher(tenantId, teacherId);

    const totalPeriodsCount = await this.prisma.periodTiming.count({
      where: { tenantId, isActive: true },
    });
    const totalPeriods = totalPeriodsCount || 8;

    const existingKeys = new Set<string>();
    const daySet = new Map<string, string>();
    for (const p of actualPeriods) {
      existingKeys.add(`${p.day}_${p.periodNumber}`);
      daySet.set(p.day, p.day);
    }

    const schoolDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const resultList = [...actualPeriods];

    for (const day of schoolDays) {
      if (!daySet.has(day)) continue;
      for (let i = 1; i <= totalPeriods; i++) {
        const key = `${day}_${i}`;
        if (!existingKeys.has(key)) {
          resultList.push({
            periodId: `free_${day}_${i}`,
            day,
            periodNumber: i,
            classSectionId: '',
            className: '',
            academicYear: '',
            startTime: '',
            endTime: '',
            subjectId: null,
            subjectName: '',
            isLeaser: false,
            isFreePeriod: true,
            substituteTeacherId: null,
            substituteTeacherName: null,
            originalTeacherName: '',
            teacherId: '',
            teacherName: '',
          });
        }
      }
    }

    return resultList;
  }

  // SUBSTITUTE TEACHER MANAGEMENT
  async saveSubstituteForPeriod(tenantId: string, periodId: string, substituteTeacherId?: string) {
    const p = await this.prisma.period.findUnique({
      where: { id: periodId },
    });
    if (!p) throw new NotFoundException('Period not found.');

    return this.prisma.period.update({
      where: { id: periodId },
      data: {
        substituteTeacherId: substituteTeacherId || null,
      },
    });
  }

  // SAVE TIMETABLE PERIODS
  async saveTimetablePeriods(tenantId: string, data: any) {
    if (!data.periods || data.periods.length === 0) {
      throw new BadRequestException('No periods provided.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete all existing periods for the classSectionId
      await tx.period.deleteMany({
        where: {
          classSectionId: data.classSectionId,
          tenantId,
        },
      });

      // 2. Fetch period timings to map timing IDs
      const timings = await tx.periodTiming.findMany({
        where: { tenantId, isActive: true },
      });
      const timingNumToId: Record<number, string> = {};
      for (const t of timings) {
        timingNumToId[t.periodNumber] = t.id;
      }

      // 3. Create new Period records
      const toInsert = [];
      for (const p of data.periods) {
        const timingId = timingNumToId[p.periodNumber];
        if (!timingId) continue;
        if (!p.subjectId || !p.teacherId) continue; // Skip unassigned cells

        toInsert.push({
          id: randomUUID(),
          tenantId,
          classSectionId: data.classSectionId,
          periodTimingId: timingId,
          dayOfWeek: p.day,
          subjectId: p.subjectId,
          teacherId: p.teacherId,
          substituteTeacherId: null,
        });
      }

      if (toInsert.length > 0) {
        await tx.period.createMany({
          data: toInsert,
        });
      }

      return {
        savedCount: toInsert.length,
        success: true,
      };
    });
  }
}
