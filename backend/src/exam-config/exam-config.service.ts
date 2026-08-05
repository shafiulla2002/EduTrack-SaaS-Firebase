import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Prisma } from '@prisma/client';

// ── Default grade ranges used when none are configured ────────────────────────
export const DEFAULT_GRADE_RANGES: GradeRange[] = [
  { min: 90, max: 100, grade: 'A+', gpa: 10, label: 'Outstanding' },
  { min: 80, max:  89, grade: 'A',  gpa: 9,  label: 'Excellent'   },
  { min: 70, max:  79, grade: 'B+', gpa: 8,  label: 'Very Good'   },
  { min: 60, max:  69, grade: 'B',  gpa: 7,  label: 'Good'        },
  { min: 50, max:  59, grade: 'C',  gpa: 6,  label: 'Average'     },
  { min: 35, max:  49, grade: 'D',  gpa: 5,  label: 'Below Avg'   },
  { min:  0, max:  34, grade: 'F',  gpa: 0,  label: 'Fail'        },
];

export interface GradeRange {
  min: number;
  max: number;
  grade: string;
  gpa: number;
  label: string;
}

export interface ResolvedExamConfig {
  passingPercentage: number;
  maxMarks: number;
  gradeRanges: GradeRange[];
  /** Which config was resolved: 'exam-specific' | 'class-specific' | 'global' | 'system-default' */
  source: 'exam-specific' | 'class-specific' | 'global' | 'system-default';
  subjectConfigs?: any[];
}

function parseGradeRanges(raw: Prisma.JsonValue | null): GradeRange[] {
  if (!raw || !Array.isArray(raw)) return DEFAULT_GRADE_RANGES;
  return raw as unknown as GradeRange[];
}

@Injectable()
export class ExamConfigService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('No active school tenant context found');
    return tenantId;
  }

  // ── Core: resolve config for a specific exam type ──────────────────────────
  async resolveConfig(examTypeName: string, classId?: string, academicYearId?: string, tenantId?: string, db?: any): Promise<ResolvedExamConfig> {
    const prisma = db ?? this.prisma;
    const tid = tenantId ?? this.getTenantId();

    // 0. Try class-specific config
    if (classId && academicYearId) {
      const classCfg = await prisma.examConfig.findFirst({
        where: { tenantId: tid, examTypeName, classId, academicYearId },
        include: { subjectConfigs: true }
      });
      if (classCfg) {
        return {
          passingPercentage: Number(classCfg.passingPercentage),
          maxMarks: classCfg.maxMarks,
          gradeRanges: parseGradeRanges(classCfg.gradeRanges),
          source: 'class-specific',
          subjectConfigs: classCfg.subjectConfigs,
        };
      }
    }

    // 1. Try exam-specific config (global template for the Exam Type, classId/academicYearId = null)
    const specific = await prisma.examConfig.findFirst({
      where: { tenantId: tid, examTypeName, classId: null, academicYearId: null },
    });
    if (specific) {
      return {
        passingPercentage: Number(specific.passingPercentage),
        maxMarks: specific.maxMarks,
        gradeRanges: parseGradeRanges(specific.gradeRanges),
        source: 'exam-specific',
      };
    }

    // 2. Try global config (stored under key '__global__')
    const globalCfg = await prisma.examConfig.findFirst({
      where: { tenantId: tid, examTypeName: '__global__', classId: null, academicYearId: null },
    });
    if (globalCfg) {
      return {
        passingPercentage: Number(globalCfg.passingPercentage),
        maxMarks: globalCfg.maxMarks,
        gradeRanges: parseGradeRanges(globalCfg.gradeRanges),
        source: 'global',
      };
    }

    // 3. System default
    return {
      passingPercentage: 35,
      maxMarks: 100,
      gradeRanges: DEFAULT_GRADE_RANGES,
      source: 'system-default',
    };
  }

  // ── Grade calculation ──────────────────────────────────────────────────────
  calculateGrade(percentage: number, ranges: GradeRange[]): GradeRange {
    const active = ranges && ranges.length > 0 ? ranges : DEFAULT_GRADE_RANGES;
    const sorted = [...active].sort((a, b) => b.min - a.min);
    return (
      sorted.find(r => percentage >= r.min && percentage <= r.max) ??
      { min: 0, max: 0, grade: 'F', gpa: 0, label: 'Fail' }
    );
  }

  // ── List all configs for a tenant ─────────────────────────────────────────
  async listConfigs() {
    const tenantId = this.getTenantId();
    const configs = await this.prisma.examConfig.findMany({
      where: { tenantId },
      include: {
        subjectConfigs: true,
        class: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return configs.map(c => ({
      id: c.id,
      examTypeName: c.examTypeName === '__global__' ? null : c.examTypeName,
      isGlobal: c.examTypeName === '__global__',
      passingPercentage: Number(c.passingPercentage),
      maxMarks: c.maxMarks,
      gradeRanges: parseGradeRanges(c.gradeRanges),
      academicYearId: c.academicYearId,
      classId: c.classId,
      className: c.class?.name || null,
      subjectConfigs: c.subjectConfigs.map(sc => ({
        ...sc,
        passMarks: sc.passMarks ? Number(sc.passMarks) : null,
        passingPercentage: Number(sc.passingPercentage),
      })),
      updatedAt: c.updatedAt,
    }));
  }

  // ── Upsert (create or update) ──────────────────────────────────────────────
  async upsertConfig(dto: {
    examTypeName: string | null;   // null = global
    passingPercentage: number;
    maxMarks?: number;
    gradeRanges?: GradeRange[];
    classId?: string;
    academicYearId?: string;
    subjectConfigs?: {
      subjectId: string;
      subjectType: string;
      maxMarks: number;
      passMarks?: number;
      passingPercentage: number;
      remarks?: string;
    }[];
  }) {
    const tenantId = this.getTenantId();

    if (dto.passingPercentage < 0 || dto.passingPercentage > 100) {
      throw new BadRequestException('Passing percentage must be between 0 and 100');
    }

    const key = dto.examTypeName === null ? '__global__' : dto.examTypeName.trim();
    const gradeRangesJson = dto.gradeRanges
      ? (dto.gradeRanges as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    return this.prisma.$transaction(async (tx) => {
      // Find existing
      let config = await tx.examConfig.findFirst({
        where: {
          tenantId,
          examTypeName: key,
          academicYearId: dto.academicYearId || null,
          classId: dto.classId || null,
        }
      });

      if (config) {
        config = await tx.examConfig.update({
          where: { id: config.id },
          data: {
            passingPercentage: dto.passingPercentage,
            maxMarks: dto.maxMarks ?? 100,
            gradeRanges: gradeRangesJson,
          }
        });
      } else {
        config = await tx.examConfig.create({
          data: {
            tenantId,
            examTypeName: key,
            passingPercentage: dto.passingPercentage,
            maxMarks: dto.maxMarks ?? 100,
            gradeRanges: gradeRangesJson,
            academicYearId: dto.academicYearId || null,
            classId: dto.classId || null,
          }
        });
      }

      if (dto.subjectConfigs) {
        // Clear old configs
        await tx.examConfigSubject.deleteMany({
          where: { examConfigId: config.id }
        });

        // Insert new ones
        if (dto.subjectConfigs.length > 0) {
          await tx.examConfigSubject.createMany({
            data: dto.subjectConfigs.map(s => ({
              tenantId,
              examConfigId: config.id,
              subjectId: s.subjectId,
              subjectType: s.subjectType || 'Theory',
              maxMarks: s.maxMarks,
              passingPercentage: s.passingPercentage,
              passMarks: s.passMarks ?? Math.round((s.passingPercentage / 100) * s.maxMarks),
              remarks: s.remarks,
            }))
          });
        }
      }

      return config;
    });
  }

  // ── Delete a specific config ───────────────────────────────────────────────
  async deleteConfig(id: string) {
    const tenantId = this.getTenantId();
    const record = await this.prisma.examConfig.findUnique({ where: { id } });
    if (!record || record.tenantId !== tenantId) {
      throw new BadRequestException('Exam config not found');
    }
    return this.prisma.examConfig.delete({ where: { id } });
  }

  // ── Get default grade ranges (for frontend) ───────────────────────────────
  getDefaultGradeRanges(): GradeRange[] {
    return DEFAULT_GRADE_RANGES;
  }

  // ── Subject Component Management ──────────────────────────────────────────
  async listComponents() {
    const tenantId = this.getTenantId();
    return this.prisma.subjectComponent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComponent(name: string) {
    const tenantId = this.getTenantId();
    if (!name || name.trim() === '') throw new BadRequestException('Component name cannot be empty');
    const existing = await this.prisma.subjectComponent.findUnique({
      where: { name_tenantId: { name: name.trim(), tenantId } },
    });
    if (existing) throw new BadRequestException('Component already exists');
    return this.prisma.subjectComponent.create({
      data: { name: name.trim(), tenantId },
    });
  }

  async deleteComponent(id: string) {
    const tenantId = this.getTenantId();
    const comp = await this.prisma.subjectComponent.findUnique({ where: { id } });
    if (!comp || comp.tenantId !== tenantId) throw new NotFoundException('Component not found');
    return this.prisma.subjectComponent.delete({ where: { id } });
  }

  // ── ExamSubject Runtime Architecture ──────────────────────────────────────
  async getOrInitializeExamSubject(examId: string, subjectId: string, subjectType: string = 'Theory', tenantId?: string, db?: any) {
    const prisma = db ?? this.prisma;
    const tid = tenantId ?? this.getTenantId();
    
    let examSubject = await prisma.examSubject.findUnique({
      where: { examId_subjectId_subjectType: { examId, subjectId, subjectType } },
    });

    if (!examSubject) {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { classSection: { include: { class: true } } }
      });
      if (!exam) throw new NotFoundException('Exam not found');

      const classId = exam.classSection?.classId;
      const academicYearId = exam.classSection?.class?.academicYearId;

      const cfg = await this.resolveConfig(exam.type, classId, academicYearId, tid, db);

      // Check if this specific subject/component has an override
      let maxMarks = cfg.maxMarks;
      let passingPercentage = cfg.passingPercentage;
      let passMarks = Math.round((cfg.passingPercentage / 100) * cfg.maxMarks);

      if (cfg.subjectConfigs && cfg.subjectConfigs.length > 0) {
        const sc = cfg.subjectConfigs.find(s => s.subjectId === subjectId && s.subjectType === subjectType);
        if (sc) {
          maxMarks = sc.maxMarks;
          passingPercentage = Number(sc.passingPercentage);
          passMarks = sc.passMarks ? Number(sc.passMarks) : Math.round((Number(sc.passingPercentage) / 100) * sc.maxMarks);
        }
      }

      examSubject = await prisma.examSubject.create({
        data: {
          tenantId: tid,
          examId,
          subjectId,
          subjectType,
          maxMarks,
          passingPercentage,
          passMarks,
        }
      });
    }

    return examSubject;
  }
  
  async getExamSubjects(examId: string) {
    const tenantId = this.getTenantId();
    return this.prisma.examSubject.findMany({
      where: { examId, tenantId },
      include: { subject: true },
      orderBy: [
        { subject: { name: 'asc' } },
        { subjectType: 'asc' }
      ]
    });
  }

  async updateExamSubject(id: string, dto: { maxMarks?: number; passMarks?: number; passingPercentage?: number; subjectType?: string; remarks?: string; }) {
    const tenantId = this.getTenantId();
    const examSubject = await this.prisma.examSubject.findUnique({ where: { id } });
    if (!examSubject || examSubject.tenantId !== tenantId) throw new NotFoundException('Exam Subject not found');

    // If max marks change or subject type change, ensure no marks exist
    if ((dto.maxMarks !== undefined && dto.maxMarks !== examSubject.maxMarks) || 
        (dto.subjectType !== undefined && dto.subjectType !== examSubject.subjectType)) {
      const existingMarks = await this.prisma.examMark.findFirst({
        where: { examId: examSubject.examId, subjectId: examSubject.subjectId, subjectType: examSubject.subjectType }
      });
      if (existingMarks) {
        throw new BadRequestException('Cannot modify Max Marks or Component Type because student marks have already been recorded for this component.');
      }
    }

    const updateData: any = {};
    if (dto.maxMarks !== undefined) updateData.maxMarks = dto.maxMarks;
    if (dto.passingPercentage !== undefined) updateData.passingPercentage = dto.passingPercentage;
    if (dto.passMarks !== undefined) updateData.passMarks = dto.passMarks;
    if (dto.subjectType !== undefined) updateData.subjectType = dto.subjectType;
    if (dto.remarks !== undefined) updateData.remarks = dto.remarks;

    return this.prisma.examSubject.update({
      where: { id },
      data: updateData,
    });
  }

  async createExamSubjectsForExam(examId: string, classSectionId: string, tenantId?: string, db?: any) {
    const prisma = db ?? this.prisma;
    const tid = tenantId ?? this.getTenantId();
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return;

    // Get all subjects assigned to the class section, and get class details
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: {
        class: true,
      }
    });

    if (!classSection) return;

    const classSubjects = await prisma.classSubject.findMany({
      where: { classSectionId },
    });

    // Resolve template config for this exam type + class
    const cfg = await this.resolveConfig(exam.type, classSection.classId, classSection.class.academicYearId, tid, db);

    if (cfg.subjectConfigs && cfg.subjectConfigs.length > 0) {
      // Create specific components defined in the class template
      for (const cs of classSubjects) {
        // Find if template has this subject specifically
        const subConfigs = cfg.subjectConfigs.filter(sc => sc.subjectId === cs.subjectId);
        
        if (subConfigs.length > 0) {
          for (const sc of subConfigs) {
            await prisma.examSubject.upsert({
              where: { examId_subjectId_subjectType: { examId, subjectId: cs.subjectId, subjectType: sc.subjectType } },
              create: {
                tenantId: tid,
                examId,
                subjectId: cs.subjectId,
                subjectType: sc.subjectType,
                maxMarks: sc.maxMarks,
                passingPercentage: Number(sc.passingPercentage),
                passMarks: sc.passMarks ? Number(sc.passMarks) : Math.round((Number(sc.passingPercentage) / 100) * sc.maxMarks),
                remarks: sc.remarks,
              },
              update: {} // do nothing if it already exists
            });
          }
        } else {
          // Fallback to default Theory for this subject using global config marks
          await prisma.examSubject.upsert({
            where: { examId_subjectId_subjectType: { examId, subjectId: cs.subjectId, subjectType: 'Theory' } },
            create: {
              tenantId: tid,
              examId,
              subjectId: cs.subjectId,
              subjectType: 'Theory',
              maxMarks: cfg.maxMarks,
              passingPercentage: cfg.passingPercentage,
              passMarks: Math.round((cfg.passingPercentage / 100) * cfg.maxMarks),
            },
            update: {}
          });
        }
      }
    } else {
      // Eagerly create default 'Theory' component for all subjects using global template
      for (const cs of classSubjects) {
        await prisma.examSubject.upsert({
          where: { examId_subjectId_subjectType: { examId, subjectId: cs.subjectId, subjectType: 'Theory' } },
          create: {
            tenantId: tid,
            examId,
            subjectId: cs.subjectId,
            subjectType: 'Theory',
            maxMarks: cfg.maxMarks,
            passingPercentage: cfg.passingPercentage,
            passMarks: Math.round((cfg.passingPercentage / 100) * cfg.maxMarks),
          },
          update: {} // do nothing if it already exists
        });
      }
    }
  }
}
