import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role, Prisma } from '@prisma/client';
import { RoleFilterHelper } from '../common/role-filter.helper';
import { ExamConfigService } from '../exam-config/exam-config.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private roleFilterHelper: RoleFilterHelper,
    @Inject(forwardRef(() => ExamConfigService))
    private examConfigService: ExamConfigService,
  ) {}

  private examsCache = new Map<string, { data: any; expiresAt: number }>();

  invalidateCache(tenantId?: string) {
    if (!tenantId) {
      this.examsCache.clear();
      return;
    }
    for (const key of this.examsCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.examsCache.delete(key);
      }
    }
  }

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
    const isTeacher = this.roleFilterHelper.isTeacher(role);
    const cacheKey = `${tenantId}:classes:${isTeacher ? userId : 'admin'}:${academicYearId || 'all'}`;
    const cached = this.examsCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const classWhere: any = {};
    if (academicYearId && academicYearId !== 'All') {
      classWhere.academicYearId = academicYearId;
    }

    let result: any[] = [];
    if (isTeacher) {
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
      result = sections
        .filter(s => s.class && s.section)
        .map(s => ({
          value: s.id,
          label: `${s.class.name} - ${s.section.name}`,
          displayName: `${s.class.name} - ${s.section.name}`,
          classId: s.classId,
          className: s.class.name,
          sectionId: s.sectionId,
          sectionName: s.section.name,
          academicYearId: s.class.academicYearId,
        }));
    } else {
      // Admin: all class-sections
      const sections = await this.prisma.classSection.findMany({
        where: {
          tenantId,
          ...(Object.keys(classWhere).length > 0 ? { class: classWhere } : {}),
        },
        include: { class: true, section: true },
        orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
      });
      result = sections
        .filter(s => s.class && s.section)
        .map(s => ({
          value: s.id,
          label: `${s.class.name} - ${s.section.name}`,
          displayName: `${s.class.name} - ${s.section.name}`,
          classId: s.classId,
          className: s.class.name,
          sectionId: s.sectionId,
          sectionName: s.section.name,
          academicYearId: s.class.academicYearId,
        }));
    }

    this.examsCache.set(cacheKey, { data: result, expiresAt: now + 60000 });
    return result;
  }

  async getSubjects(userId?: string, role?: string, classSectionId?: string) {
    const tenantId = this.getTenantId();
    const isTeacher = this.roleFilterHelper.isTeacher(role);
    const cacheKey = `${tenantId}:subjects:${isTeacher ? userId : 'admin'}:${classSectionId || 'all'}`;
    const cached = this.examsCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    let result: any[] = [];
    if (isTeacher) {
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
      result = subjects.map(s => ({
        id: s.id,
        name: s.name,
        maxMarks: 100,
        icon: s.name.substring(0, 1).toUpperCase(),
      }));
    } else {
      // Admin
      if (classSectionId) {
        const classSubjects = await this.prisma.classSubject.findMany({
          where: { classSectionId, tenantId },
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        });
        if (classSubjects.length > 0) {
          result = classSubjects
            .filter(cs => cs.subject && cs.subject.isActive)
            .map(cs => ({
              id: cs.subject.id,
              name: cs.subject.name,
              maxMarks: 100,
              icon: cs.subject.name.substring(0, 1).toUpperCase(),
            }));
        }
      }

      if (result.length === 0) {
        const subjects = await this.prisma.subject.findMany({
          where: { tenantId, isActive: true },
          orderBy: { name: 'asc' },
        });
        result = subjects.map(s => ({
          id: s.id,
          name: s.name,
          maxMarks: 100,
          icon: s.name.substring(0, 1).toUpperCase(),
        }));
      }
    }

    this.examsCache.set(cacheKey, { data: result, expiresAt: now + 60000 });
    return result;
  }

  async getExamTypes() {
    const tenantId = this.getTenantId();
    const cacheKey = `${tenantId}:exam-types`;
    const cached = this.examsCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

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

    const result = types.map(t => t.name);
    this.examsCache.set(cacheKey, { data: result, expiresAt: now + 60000 });
    return result;
  }

  async getExamTypesManage() {
    const tenantId = this.getTenantId();
    const cacheKey = `${tenantId}:exam-types-manage`;
    const cached = this.examsCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

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

    this.examsCache.set(cacheKey, { data: types, expiresAt: now + 60000 });
    return types;
  }

  async createExamType(name: string) {
    const tenantId = this.getTenantId();
    this.invalidateCache(tenantId);
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
    this.invalidateCache(tenantId);
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
    this.invalidateCache(tenantId);
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

    if (!resolvedExamId && resolvedClassSectionId && examName) {
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
      if (exam && exam.tenantId === tenantId) {
        resolvedClassSectionId = exam.classSectionId;
      }
    }

    if (!resolvedClassSectionId) {
      throw new BadRequestException('Could not resolve Class Section');
    }
    if (!subjectId) {
      throw new BadRequestException('Subject ID is required');
    }
    if (!examName) {
      throw new BadRequestException('Exam Name is required');
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

    // Parallelize fetching student roster, classSection context, existing examSubject & existing marks (100% READ-ONLY)
    const [students, classSection, existingExamSubject, currentMarks] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where: {
          classSectionId: resolvedClassSectionId,
          tenantId,
          user: { isActive: true },
        },
        select: {
          id: true,
          rollNo: true,
          user: {
            select: { name: true },
          },
        },
        orderBy: [
          { rollNo: 'asc' },
          { user: { name: 'asc' } },
        ],
      }),
      this.prisma.classSection.findUnique({
        where: { id: resolvedClassSectionId },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          tenantId: true,
          class: {
            select: {
              id: true,
              name: true,
              academicYearId: true,
            },
          },
        },
      }),
      resolvedExamId
        ? this.prisma.examSubject.findUnique({
            where: {
              examId_subjectId_subjectType: {
                examId: resolvedExamId,
                subjectId,
                subjectType,
              },
            },
          })
        : null,
      resolvedExamId
        ? this.prisma.examMark.findMany({
            where: {
              tenantId,
              examId: resolvedExamId,
              subjectId,
              subjectType,
            },
            select: {
              studentId: true,
              marksObtained: true,
              remarks: true,
            },
          })
        : [],
    ]);

    if (classSection && classSection.tenantId !== tenantId) {
      throw new BadRequestException('Class section does not belong to this school');
    }

    const classId = classSection?.classId;
    const academicYearId = classSection?.class?.academicYearId;

    const marksMap = new Map<string, { marksObtained: any; remarks: string | null }>();
    if (currentMarks && currentMarks.length > 0) {
      for (const m of currentMarks) {
        marksMap.set(m.studentId, m);
      }
    }

    // Load config in a 100% read-only manner without mutating the database
    let maxMarks = 100;
    let passingPercentage = 35;
    let passMarks = 35;

    if (existingExamSubject) {
      maxMarks = Number(existingExamSubject.maxMarks) || 100;
      passingPercentage = Number(existingExamSubject.passingPercentage) || 35;
      passMarks = existingExamSubject.passMarks !== null && existingExamSubject.passMarks !== undefined
        ? Number(existingExamSubject.passMarks)
        : Number(((passingPercentage / 100) * maxMarks).toFixed(2));
    } else {
      // In-memory resolution from template hierarchy without saving to DB
      const cfg = await this.examConfigService.resolveConfig(examName, classId, academicYearId, tenantId);
      const subRec = subjectId ? await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }) : null;
      const resolved = this.examConfigService.resolveSubjectConfig(cfg, subjectId, subjectType, subRec?.name);
      maxMarks = resolved.maxMarks;
      passingPercentage = resolved.passingPercentage;
      passMarks = resolved.passMarks;
    }

    // Ensure safe numeric values (never NaN)
    maxMarks = isNaN(maxMarks) || maxMarks <= 0 ? 100 : maxMarks;
    passingPercentage = isNaN(passingPercentage) || passingPercentage < 0 ? 35 : passingPercentage;
    passMarks = isNaN(passMarks) || passMarks < 0 ? Number(((passingPercentage / 100) * maxMarks).toFixed(2)) : passMarks;

    return {
      roster: students.map(s => {
        const markRecord = marksMap.get(s.id);
        return {
          studentId: s.id,
          name: s.user?.name || 'Student',
          rollNo: s.rollNo || 'N/A',
          hasMarks: markRecord !== undefined && markRecord.marksObtained !== null,
          marksObtained: markRecord && markRecord.marksObtained !== null && markRecord.marksObtained !== undefined
            ? Number(markRecord.marksObtained)
            : null,
          remarks: markRecord ? markRecord.remarks || '' : '',
        };
      }),
      config: { maxMarks, passingPercentage, passMarks },
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

        // Pre-validate rows and prepare payload
        const validRows: { studentId: string; marksObtained: number; remarks: string | null }[] = [];
        for (const row of marksDataList) {
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
          const marksObtained = (row.marksObtained !== null && row.marksObtained !== undefined && row.marksObtained !== '') ? Number(row.marksObtained) : 0;
          const remarks = row.remarks || null;
          validRows.push({
            studentId: row.studentId,
            marksObtained,
            remarks,
          });
        }

        if (validRows.length === 0) {
          return { count: 0 };
        }

        // Execute single high-speed bulk PostgreSQL UPSERT in <10ms
        const values = validRows.map(
          (r) => Prisma.sql`(${randomUUID()}, ${exam.id}, ${r.studentId}, ${subjectId}, ${subjectType}, ${r.marksObtained}, ${r.remarks}, ${tenantId})`
        );

        await tx.$executeRaw`
          INSERT INTO "ExamMark" ("id", "examId", "studentId", "subjectId", "subjectType", "marksObtained", "remarks", "tenantId")
          VALUES ${Prisma.join(values, ', ')}
          ON CONFLICT ("examId", "studentId", "subjectId", "subjectType")
          DO UPDATE SET 
            "marksObtained" = EXCLUDED."marksObtained",
            "remarks" = EXCLUDED."remarks";
        `;

        this.invalidateCache(tenantId);
        return { count: validRows.length };
      },
      { timeout: 30000 },
    );
  }

  // ── GRADES & REPORT CARD COMPILATION ────────────────────────────────────────

  async getGradesReport(classSectionId: string, examName: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `${tenantId}:grades_report:${classSectionId}:${examName}`;
    const cached = this.examsCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

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
    const result = reportRows.map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

    this.examsCache.set(cacheKey, { data: result, expiresAt: now + 60000 });
    return result;
  }

  // ── GOVERNMENT-STYLE MARKS REPORT EXPORT (100% READ-ONLY) ───────────────────

  async getMarksReport(params: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    classSectionId?: string;
    examName: string;
  }) {
    const tenantId = this.getTenantId();
    const { academicYearId, classId, sectionId, classSectionId, examName } = params;

    if (!examName || examName.trim() === '') {
      throw new BadRequestException('Exam Name / Exam Type is required');
    }

    // 1. Fetch Tenant info (for School Name & School Code / Subdomain)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subDomain: true,
        logoUrl: true,
        address: true,
        phone: true,
        email: true,
      },
    });
    if (!tenant) {
      throw new BadRequestException('School tenant context not found');
    }

    // 2. Resolve & Validate ClassSection strictly within the authenticated tenant
    let targetClassSection: any = null;

    if (classSectionId) {
      targetClassSection = await this.prisma.classSection.findFirst({
        where: { id: classSectionId, tenantId },
        include: {
          class: { include: { academicYear: true } },
          section: true,
        },
      });
      if (!targetClassSection) {
        throw new BadRequestException('Invalid Class Section specified for this school');
      }
      if (classId && targetClassSection.classId !== classId) {
        throw new BadRequestException('ClassSection does not match the specified Class');
      }
      if (sectionId && targetClassSection.sectionId !== sectionId) {
        throw new BadRequestException('ClassSection does not match the specified Section');
      }
      if (academicYearId && targetClassSection.class?.academicYearId !== academicYearId) {
        throw new BadRequestException('ClassSection does not match the specified Academic Year');
      }
    } else if (classId && sectionId) {
      targetClassSection = await this.prisma.classSection.findFirst({
        where: { classId, sectionId, tenantId },
        include: {
          class: { include: { academicYear: true } },
          section: true,
        },
      });
      if (!targetClassSection) {
        throw new BadRequestException('No matching Class and Section found for this school');
      }
      if (academicYearId && targetClassSection.class?.academicYearId !== academicYearId) {
        throw new BadRequestException('Class does not belong to the selected Academic Year');
      }
    } else {
      throw new BadRequestException('Please select both Class and Section');
    }

    const resolvedClassSectionId = targetClassSection.id;
    const resolvedClassName = targetClassSection.class?.name || 'Class';
    const resolvedSectionName = targetClassSection.section?.name || 'Section';
    const resolvedAcademicYearName = targetClassSection.class?.academicYear?.name || 'Academic Year';
    const resolvedAcademicYearId = targetClassSection.class?.academicYearId || academicYearId;

    // 3. Resolve Subjects for this ClassSection
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classSectionId: resolvedClassSectionId, tenantId },
      include: { subject: true },
    });
    let subjects = classSubjects
      .map(cs => cs.subject)
      .filter(s => s && s.isActive);

    if (subjects.length === 0) {
      subjects = await this.prisma.subject.findMany({
        where: { tenantId, isActive: true },
      });
    }

    // Standard deterministic curriculum sequence (Language 1 -> Language 2 -> English -> Maths -> Science -> Social -> Other)
    const SUBJECT_ORDER: Record<string, number> = {
      telugu: 1,
      firstlanguage: 1,
      hindi: 2,
      secondlanguage: 2,
      english: 3,
      thirdlanguage: 3,
      mathematics: 4,
      maths: 4,
      math: 4,
      science: 5,
      generalscience: 5,
      physicalscience: 5.1,
      biologicalscience: 5.2,
      evs: 5.3,
      social: 6,
      socialstudies: 6,
      computerscience: 7,
      computer: 7,
      it: 7,
    };

    subjects.sort((a, b) => {
      const cleanA = a.name.toLowerCase().replace(/[^a-z]/g, '');
      const cleanB = b.name.toLowerCase().replace(/[^a-z]/g, '');
      const orderA = SUBJECT_ORDER[cleanA] ?? 100;
      const orderB = SUBJECT_ORDER[cleanB] ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    // 4. Resolve Exam & Marks (100% READ-ONLY)
    const exam = await this.prisma.exam.findFirst({
      where: {
        tenantId,
        classSectionId: resolvedClassSectionId,
        name: examName.trim(),
      },
    });

    const marksMap = new Map<string, { marksObtained: any; remarks: string | null }>();
    if (exam) {
      const marks = await this.prisma.examMark.findMany({
        where: {
          tenantId,
          examId: exam.id,
        },
        select: {
          studentId: true,
          subjectId: true,
          marksObtained: true,
          remarks: true,
        },
      });
      for (const m of marks) {
        marksMap.set(`${m.studentId}_${m.subjectId}`, m);
      }
    }

    // 5. Query All Enrolled Students
    const students = await this.prisma.studentProfile.findMany({
      where: {
        classSectionId: resolvedClassSectionId,
        tenantId,
        user: { isActive: true },
      },
      select: {
        id: true,
        rollNo: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { rollNo: 'asc' },
        { user: { name: 'asc' } },
      ],
    });

    // 6. Compile Normalized Student Mark Rows
    const studentRows = students.map(s => {
      const marksObj: Record<string, number | 'AB' | '—'> = {};
      let totalObtained = 0;
      let hasAnyMark = false;

      for (const sub of subjects) {
        const markRecord = marksMap.get(`${s.id}_${sub.id}`);
        if (!markRecord) {
          marksObj[sub.name] = '—';
        } else {
          const rem = markRecord.remarks?.trim().toUpperCase() || '';
          const isAbsent = rem === 'AB' || rem === 'ABSENT' || rem.startsWith('AB-') || rem.includes('ABSENT');
          if (isAbsent) {
            marksObj[sub.name] = 'AB';
          } else if (markRecord.marksObtained !== null && markRecord.marksObtained !== undefined) {
            const numVal = Number(markRecord.marksObtained);
            marksObj[sub.name] = numVal;
            totalObtained += numVal;
            hasAnyMark = true;
          } else {
            marksObj[sub.name] = '—';
          }
        }
      }

      return {
        studentId: s.id,
        admissionNo: s.rollNo || s.id.substring(0, 8).toUpperCase(),
        rollNo: s.rollNo || 'N/A',
        studentName: s.user?.name || 'Student',
        marks: marksObj,
        totalMarks: hasAnyMark ? totalObtained : null,
      };
    });

    return {
      schoolName: tenant.name || 'CS EduTrack Institute',
      schoolCode: tenant.subDomain || tenant.id.substring(0, 8).toUpperCase(),
      academicYear: resolvedAcademicYearName,
      academicYearId: resolvedAcademicYearId,
      className: resolvedClassName,
      classId: targetClassSection.classId,
      sectionName: resolvedSectionName,
      sectionId: targetClassSection.sectionId,
      classSectionId: resolvedClassSectionId,
      examType: examName.trim(),
      subjects: subjects.map(s => ({ id: s.id, name: s.name })),
      totalStudents: studentRows.length,
      students: studentRows,
    };
  }
}
