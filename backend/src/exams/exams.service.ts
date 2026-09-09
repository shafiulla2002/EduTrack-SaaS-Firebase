import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role } from '@prisma/client';
import { RoleFilterHelper } from '../common/role-filter.helper';
import { ExamConfigService } from '../exam-config/exam-config.service';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private roleFilterHelper: RoleFilterHelper,
    @Inject(forwardRef(() => ExamConfigService))
    private examConfigService: ExamConfigService,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  // ── EXAM MANAGEMENT ─────────────────────────────────────────────────────────

  async createExam(name: string, type: string, classSectionId: string, date: Date) {
    const tenantId = this.getTenantId();
    const exam = await this.prisma.exam.create({
      data: {
        name,
        type,
        classSectionId,
        date: new Date(date),
        tenantId,
      },
    });

    // Eagerly initialize exam subjects configuration templates
    await this.examConfigService.createExamSubjectsForExam(exam.id, classSectionId, tenantId);

    return exam;
  }

  async getExams(classSectionId?: string) {
    const tenantId = this.getTenantId();
    return this.prisma.exam.findMany({
      where: {
        tenantId,
        ...(classSectionId ? { classSectionId } : {}),
      },
      include: {
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  // ── CUSTOM API ENDPOINTS FOR FRONTEND PARITY WITH SALESFORCE ────────────────

  async getClasses(userId?: string, role?: string, academicYearId?: string) {
    const tenantId = this.getTenantId();
    const classWhere: any = {};
    if (academicYearId && academicYearId !== 'All') {
      classWhere.academicYearId = academicYearId;
    }

    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (scope.assignedClassSectionIds.length === 0) return [];
      const sections = await this.prisma.classSection.findMany({
        where: {
          id: { in: scope.assignedClassSectionIds },
          tenantId,
          ...(Object.keys(classWhere).length > 0 ? { class: classWhere } : {}),
        },
        include: { class: true, section: true },
        orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
      });
      return sections
        .filter(s => s.class && s.section)
        .map(s => ({
          value: s.id,
          label: `${s.class.name} - ${s.section.name}`,
          displayName: `${s.class.name} - ${s.section.name}`,
          classId: s.classId,
          sectionId: s.sectionId,
        }));
    }

    // Admin: all class-sections
    const sections = await this.prisma.classSection.findMany({
      where: {
        tenantId,
        ...(Object.keys(classWhere).length > 0 ? { class: classWhere } : {}),
      },
      include: { class: true, section: true },
      orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
    });
    return sections
      .filter(s => s.class && s.section)
      .map(s => ({
        value: s.id,
        label: `${s.class.name} - ${s.section.name}`,
        displayName: `${s.class.name} - ${s.section.name}`,
        classId: s.classId,
        sectionId: s.sectionId,
      }));
  }

  async getSubjects(userId?: string, role?: string, classSectionId?: string) {
    const tenantId = this.getTenantId();
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      if (scope.assignedSubjectIds.length === 0) return [];

      let targetSubjectIds = scope.assignedSubjectIds;
      if (classSectionId) {
        const classMappings = await this.prisma.classSubject.findMany({
          where: { classSectionId, tenantId, subjectId: { in: targetSubjectIds } },
          select: { subjectId: true },
        });
        if (classMappings.length > 0) {
          targetSubjectIds = classMappings.map(cm => cm.subjectId);
        }
      }

      const subjects = await this.prisma.subject.findMany({
        where: { id: { in: targetSubjectIds }, tenantId, isActive: true },
        orderBy: { name: 'asc' },
      });
      return subjects.map(s => ({
        id: s.id,
        name: s.name,
        maxMarks: 100,
        icon: s.name.substring(0, 1).toUpperCase(),
      }));
    }

    // Admin
    if (classSectionId) {
      const classSubjects = await this.prisma.classSubject.findMany({
        where: { classSectionId, tenantId },
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      });
      if (classSubjects.length > 0) {
        return classSubjects
          .filter(cs => cs.subject && cs.subject.isActive)
          .map(cs => ({
            id: cs.subject.id,
            name: cs.subject.name,
            maxMarks: 100,
            icon: cs.subject.name.substring(0, 1).toUpperCase(),
          }));
      }
      // If no class-specific mappings configured yet for this section,
      // fallback to tenant-wide active subjects so scheduling is not blocked.
    }

    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return subjects.map(s => ({
      id: s.id,
      name: s.name,
      maxMarks: 100,
      icon: s.name.substring(0, 1).toUpperCase(),
    }));
  }

  async getExamTypes() {
    const tenantId = this.getTenantId();
    let types = await this.prisma.examType.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (types.length === 0) {
      const defaults = [
        'Unit Test',
        'Monthly Test',
        'Quarterly Exam',
        'Half-Yearly Exam',
        'Annual Exam',
        'Pre-Final Exam'
      ];
      await this.prisma.examType.createMany({
        data: defaults.map(name => ({ name, tenantId })),
      });
      types = await this.prisma.examType.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });
    }

    return types.map(t => t.name);
  }

  async getExamTypesManage() {
    const tenantId = this.getTenantId();
    let types = await this.prisma.examType.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (types.length === 0) {
      const defaults = [
        'Unit Test',
        'Monthly Test',
        'Quarterly Exam',
        'Half-Yearly Exam',
        'Annual Exam',
        'Pre-Final Exam'
      ];
      await this.prisma.examType.createMany({
        data: defaults.map(name => ({ name, tenantId })),
      });
      types = await this.prisma.examType.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });
    }

    return types;
  }

  async createExamType(name: string) {
    const tenantId = this.getTenantId();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Exam type name cannot be empty');
    }
    const existing = await this.prisma.examType.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' }, tenantId }
    });
    if (existing) {
      throw new BadRequestException('Exam type already exists');
    }
    return this.prisma.examType.create({
      data: { name: trimmed, tenantId }
    });
  }

  async updateExamType(id: string, name: string) {
    const tenantId = this.getTenantId();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Exam type name cannot be empty');
    }
    const examType = await this.prisma.examType.findUnique({ where: { id } });
    if (!examType || examType.tenantId !== tenantId) {
      throw new BadRequestException('Exam type not found');
    }
    const existing = await this.prisma.examType.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' }, tenantId, id: { not: id } }
    });
    if (existing) {
      throw new BadRequestException('Another exam type with this name already exists');
    }
    return this.prisma.examType.update({
      where: { id },
      data: { name: trimmed }
    });
  }

  async deleteExamType(id: string) {
    const tenantId = this.getTenantId();
    const examType = await this.prisma.examType.findUnique({ where: { id } });
    if (!examType || examType.tenantId !== tenantId) {
      throw new BadRequestException('Exam type not found');
    }
    return this.prisma.examType.delete({ where: { id } });
  }

  // ── MARKS ENTRY & PROCESSING ───────────────────────────────────────────────

  async getStudentsForMarksEntry(
    subjectId: string,
    examName: string,
    classSectionId?: string,
    examId?: string,
    userId?: string,
    role?: string,
    subjectType: string = 'Theory',
  ) {
    const tenantId = this.getTenantId();
    let resolvedExamId = examId;
    let resolvedClassSectionId = classSectionId;

    if (!resolvedExamId && resolvedClassSectionId) {
      const exam = await this.prisma.exam.findFirst({
        where: {
          tenantId,
          classSectionId: resolvedClassSectionId,
          name: examName,
        },
      });
      if (exam) {
        resolvedExamId = exam.id;
      }
    } else if (resolvedExamId && !resolvedClassSectionId) {
      const exam = await this.prisma.exam.findUnique({
        where: { id: resolvedExamId },
      });
      if (exam) {
        resolvedClassSectionId = exam.classSectionId;
      }
    }

    if (!resolvedClassSectionId) {
      throw new BadRequestException('Could not resolve Class Section');
    }

    // Verify teacher assignment (getStudentsForMarksEntry)
    if (this.roleFilterHelper.isTeacher(role)) {
      await this.roleFilterHelper.validateTeacherAssignment(
        (await this.roleFilterHelper.buildTeacherScope(userId, tenantId)).staff.id,
        resolvedClassSectionId,
        subjectId,
        tenantId,
      );
    }

    // Get all active students in the section
    const students = await this.prisma.studentProfile.findMany({
      where: {
        classSectionId: resolvedClassSectionId,
        user: { tenantId, isActive: true },
      },
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    // Resolve classSection context
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: resolvedClassSectionId },
      include: { class: true },
    });
    const classId = classSection?.classId;
    const academicYearId = classSection?.class?.academicYearId;

    const marksMap = new Map<string, any>();
    // Load config for this exact context
    let maxMarks = 100;
    let passingPercentage = 35;
    let passMarks = 35;
    
    if (resolvedExamId) {
      const currentMarks = await this.prisma.examMark.findMany({
        where: {
          tenantId,
          examId: resolvedExamId,
          subjectId,
          subjectType,
        },
      });
      for (const m of currentMarks) {
        marksMap.set(m.studentId, m);
      }
      
      const examSub = await this.examConfigService.getOrInitializeExamSubject(resolvedExamId, subjectId, subjectType, tenantId);
      maxMarks = examSub.maxMarks;
      passingPercentage = Number(examSub.passingPercentage);
      passMarks = examSub.passMarks !== null && examSub.passMarks !== undefined
        ? Number(examSub.passMarks)
        : Number(((passingPercentage / 100) * maxMarks).toFixed(2));
    } else {
      const cfg = await this.examConfigService.resolveConfig(examName, classId, academicYearId, tenantId);
      const subRec = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      const resolved = this.examConfigService.resolveSubjectConfig(cfg, subjectId, subjectType, subRec?.name);
      maxMarks = resolved.maxMarks;
      passingPercentage = resolved.passingPercentage;
      passMarks = resolved.passMarks;
    }

    return {
      roster: students.map(s => {
        const markRecord = marksMap.get(s.id);
        return {
          studentId: s.id,
          name: s.user.name,
          rollNo: s.rollNo || 'N/A',
          hasMarks: !!markRecord,
          marksObtained: markRecord ? Number(markRecord.marksObtained) : null,
          remarks: markRecord ? markRecord.remarks : '',
        };
      }),
      config: { maxMarks, passingPercentage, passMarks }
    };
  }


  async saveMarks(
    marksDataList: any[],
    examName: string,
    classSectionId: string,
    subjectId: string,
    userId?: string,
    role?: string,
    subjectType: string = 'Theory',
  ) {
    const tenantId = this.getTenantId();

    // Verify teacher assignment before saving marks
    if (this.roleFilterHelper.isTeacher(role)) {
      const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
      await this.roleFilterHelper.validateTeacherAssignment(
        scope.staff.id,
        classSectionId,
        subjectId,
        tenantId,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Find or create Exam
        let exam = await tx.exam.findFirst({
          where: {
            tenantId,
            classSectionId,
            name: examName,
          },
        });

        if (!exam) {
          exam = await tx.exam.create({
            data: {
              name: examName,
              type: examName,
              classSectionId,
              date: new Date(),
              tenantId,
            },
          });
          await this.examConfigService.createExamSubjectsForExam(exam.id, classSectionId, tenantId, tx);
        }
        
        const examSub = await this.examConfigService.getOrInitializeExamSubject(exam.id, subjectId, subjectType, tenantId, tx);

        // Run upsert operations concurrently to speed up marks saving and avoid timeouts
        const upsertPromises = marksDataList.map((row) => {
          const mObs = row.marksObtained;
          if (mObs !== null && mObs !== undefined && mObs !== '') {
            const numVal = Number(mObs);
            if (isNaN(numVal) || numVal < 0) {
              throw new BadRequestException(`Marks cannot be negative.`);
            }
            if (numVal > examSub.maxMarks) {
              throw new BadRequestException(
                `Marks obtained (${numVal}) cannot exceed the configured maximum of ${examSub.maxMarks} for ${subjectType || 'Theory'}.`
              );
            }
          }
          return tx.examMark.upsert({
            where: {
              examId_studentId_subjectId_subjectType: {
                examId: exam.id,
                studentId: row.studentId,
                subjectId,
                subjectType,
              },
            },
            create: {
              examId: exam.id,
              studentId: row.studentId,
              subjectId,
              subjectType,
              marksObtained: (row.marksObtained !== null && row.marksObtained !== undefined && row.marksObtained !== '') ? Number(row.marksObtained) : 0,
              remarks: row.remarks || null,
              tenantId,
            },
            update: {
              marksObtained: (row.marksObtained !== null && row.marksObtained !== undefined && row.marksObtained !== '') ? Number(row.marksObtained) : 0,
              remarks: row.remarks || null,
            },
          });
        });

        return Promise.all(upsertPromises);
      },
      { timeout: 30000 },
    );
  }

  // ── GRADES & REPORT CARD COMPILATION ────────────────────────────────────────

  async getGradesReport(classSectionId: string, examName: string) {
    const tenantId = this.getTenantId();

    const exam = await this.prisma.exam.findFirst({
      where: {
        tenantId,
        classSectionId,
        name: examName,
      },
    });

    if (!exam) return [];

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: { class: true },
    });
    const classId = classSection?.classId;
    const academicYearId = classSection?.class?.academicYearId;

    const resolvedCfg = await this.examConfigService.resolveConfig(
      exam.type || exam.name,
      classId,
      academicYearId,
      tenantId,
    );

    // Pre-fetch all exam subjects for this exam to avoid N+1 queries in the loop
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { tenantId, examId: exam.id },
    });
    const examSubjectMap = new Map<string, any>();
    for (const es of examSubjects) {
      examSubjectMap.set(`${es.subjectId}_${es.subjectType}`, es);
    }

    const marks = await this.prisma.examMark.findMany({
      where: {
        tenantId,
        examId: exam.id,
      },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
          },
        },
        subject: true,
      },
    });

    // Group marks by student ID
    const studentGrades = new Map<string, {
      studentId: string;
      name: string;
      rollNo: string;
      classSectionId: string;
      scores: { [subjectName: string]: number };
      totalMarks: number;
      totalMaxMarks: number;
      subjectsList: {
        name: string;
        type: string;
        score: number;
        max: number;
        passMarks: number;
        passingPercentage: number;
        isPassed: boolean;
        grade: string;
        gpa: number;
      }[];
    }>();

    for (const m of marks) {
      if (!studentGrades.has(m.studentId)) {
        studentGrades.set(m.studentId, {
          studentId: m.studentId,
          name: m.student.user.name,
          rollNo: m.student.rollNo || 'N/A',
          classSectionId,
          scores: {},
          totalMarks: 0,
          totalMaxMarks: 0,
          subjectsList: [],
        });
      }
      const record = studentGrades.get(m.studentId)!;
      const score = Number(m.marksObtained);
      
      const key = `${m.subjectId}_${m.subjectType}`;
      let examSub = examSubjectMap.get(key);
      if (!examSub) {
        examSub = await this.examConfigService.getOrInitializeExamSubject(exam.id, m.subjectId, m.subjectType, tenantId);
        examSubjectMap.set(key, examSub);
      }
      const maxMarks = examSub ? examSub.maxMarks : 100;
      const passingPercentage = Number(examSub?.passingPercentage || resolvedCfg.passingPercentage || 35);
      const passMarks = examSub?.passMarks !== null && examSub?.passMarks !== undefined
        ? Number(examSub.passMarks)
        : Number(((passingPercentage / 100) * maxMarks).toFixed(2));
      const isPassed = score >= passMarks;
      const subPct = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
      const gradeInfo = this.examConfigService.calculateGrade(subPct, resolvedCfg.gradeRanges);
      
      record.scores[`${m.subject.name} (${m.subjectType})`] = score;
      record.totalMarks += score;
      record.totalMaxMarks += maxMarks;
      record.subjectsList.push({
        name: m.subject.name,
        type: m.subjectType,
        score,
        max: maxMarks,
        passMarks,
        passingPercentage,
        isPassed,
        grade: gradeInfo.grade,
        gpa: gradeInfo.gpa,
      });
    }

    const reportRows = Array.from(studentGrades.values()).map(r => {
      const avg = r.totalMaxMarks > 0 ? (r.totalMarks / r.totalMaxMarks) * 100 : 0;
      const hasFailedSubject = r.subjectsList.some(s => !s.isPassed);
      const isPassed = !hasFailedSubject && (avg >= resolvedCfg.passingPercentage);
      const overallResult = isPassed ? 'PASSED' : 'FAILED';
      const gradeCalc = this.examConfigService.calculateGrade(avg, resolvedCfg.gradeRanges);

      // Subject failure strictly overrides overall grade to 'F' / GPA 0.0
      const grade = hasFailedSubject ? 'F' : gradeCalc.grade;
      const gpa = hasFailedSubject ? 0.0 : gradeCalc.gpa;

      return {
        ...r,
        score: Number(avg.toFixed(0)), // Overall average percentage score
        average: Number(avg.toFixed(2)),
        overallPercentage: Number(avg.toFixed(2)),
        totalMarks: r.totalMarks,
        totalMaxMarks: r.totalMaxMarks,
        grade,
        gpa,
        isPassed,
        overallResult,
        hasFailedSubject,
        passingPercentage: resolvedCfg.passingPercentage,
      };
    });

    // Calculate Ranks based on total marks
    reportRows.sort((a, b) => b.totalMarks - a.totalMarks);
    return reportRows.map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));
  }
}
