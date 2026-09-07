import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { CommunicationsService } from '../communications/communications.service';
import { CreateExamScheduleDto, UpdateExamScheduleDto, BulkCreateDto, BulkStatusDto, BulkDeleteDto } from './dto/exam-schedule.dto';

@Injectable()
export class ExamScheduleService {
  constructor(
    private prisma: PrismaService,
    private communicationsService: CommunicationsService,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  private parseTimeToMinutes(timeStr: string): number {
    const trimmed = timeStr.trim();
    // Support "10:30 AM", "13:30", "1:30 PM", "09:00", etc.
    const matches = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!matches) {
      throw new BadRequestException(`Invalid time format: ${timeStr}. Expected HH:MM or HH:MM AM/PM`);
    }
    let hours = parseInt(matches[1], 10);
    const minutes = parseInt(matches[2], 10);
    const ampm = matches[3];
    
    if (ampm) {
      const up = ampm.toUpperCase();
      if (up === 'PM' && hours < 12) hours += 12;
      if (up === 'AM' && hours === 12) hours = 0;
    }
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new BadRequestException(`Invalid time value: ${timeStr}`);
    }
    
    return hours * 60 + minutes;
  }

  private async validateSchedule(dto: CreateExamScheduleDto, excludeId?: string) {
    const tenantId = this.getTenantId();
    const startMin = this.parseTimeToMinutes(dto.startTime);
    const endMin = this.parseTimeToMinutes(dto.endTime);
    
    if (endMin <= startMin) {
      throw new BadRequestException(`End time (${dto.endTime}) must be after start time (${dto.startTime}).`);
    }

    const examDate = new Date(dto.examDate);
    if (isNaN(examDate.getTime())) {
      throw new BadRequestException(`Invalid exam date format: ${dto.examDate}. Please use YYYY-MM-DD format.`);
    }

    // 1. Validate Academic Year bounds
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: dto.academicYearId }
    });
    if (!ay || ay.tenantId !== tenantId) {
      throw new NotFoundException('Academic year not found');
    }
    if (examDate < new Date(ay.startDate) || examDate > new Date(ay.endDate)) {
      throw new BadRequestException(`Exam date must fall within the Academic Year bounds: ${new Date(ay.startDate).toLocaleDateString()} to ${new Date(ay.endDate).toLocaleDateString()}`);
    }

    // 2. Duplicate Subject Exam on the same day for that class
    const dupSubject = await this.prisma.examSchedule.findFirst({
      where: {
        tenantId,
        academicYearId: dto.academicYearId,
        classSectionId: dto.classSectionId,
        subjectId: dto.subjectId,
        examDate: examDate,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    if (dupSubject) {
      throw new BadRequestException(`An exam for subject is already scheduled for this class on this day.`);
    }

    // 3. Class Time Overlaps
    const classExams = await this.prisma.examSchedule.findMany({
      where: {
        tenantId,
        classSectionId: dto.classSectionId,
        examDate: examDate,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    for (const ex of classExams) {
      const existingStart = this.parseTimeToMinutes(ex.startTime);
      const existingEnd = this.parseTimeToMinutes(ex.endTime);
      if (startMin < existingEnd && existingStart < endMin) {
        throw new BadRequestException(`Time conflict: Class section already has an exam "${ex.examName}" from ${ex.startTime} to ${ex.endTime}.`);
      }
    }

    // 4. Hall conflicts
    if (dto.examHall && dto.examHall.trim()) {
      const hallExams = await this.prisma.examSchedule.findMany({
        where: {
          tenantId,
          examHall: dto.examHall.trim(),
          examDate: examDate,
          id: excludeId ? { not: excludeId } : undefined
        }
      });
      for (const ex of hallExams) {
        const existingStart = this.parseTimeToMinutes(ex.startTime);
        const existingEnd = this.parseTimeToMinutes(ex.endTime);
        if (startMin < existingEnd && existingStart < endMin) {
          throw new BadRequestException(`Hall conflict: Exam hall "${dto.examHall}" is booked for exam "${ex.examName}" from ${ex.startTime} to ${ex.endTime}.`);
        }
      }
    }
  }

  private async notifyTeachers(schedule: any, actionName: 'scheduled' | 'updated' | 'cancelled') {
    const tenantId = this.getTenantId();
    
    const cs = await this.prisma.classSection.findUnique({
      where: { id: schedule.classSectionId },
      include: { class: true, section: true }
    });
    const subject = await this.prisma.subject.findUnique({
      where: { id: schedule.subjectId }
    });

    const className = cs ? `${cs.class.name} - ${cs.section.name}` : 'Unknown Class';
    const subjName = subject ? subject.name : 'Unknown Subject';
    const dateStr = new Date(schedule.examDate).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    
    let title = `📢 ${schedule.examName} Schedule`;
    let content = `Class: ${className}\nSubject: ${subjName}\nDate: ${dateStr}\nTime: ${schedule.startTime} - ${schedule.endTime}\nInstructions:\n${schedule.instructions || 'Please complete the syllabus before the examination.'}`;
    
    if (actionName === 'cancelled' || schedule.status === 'Cancelled') {
      title = `❌ CANCELLED: ${schedule.examName}`;
      content = `The scheduled exam for Class: ${className}, Subject: ${subjName} on ${dateStr} has been cancelled.`;
    } else if (actionName === 'updated') {
      title = `📢 UPDATED: ${schedule.examName} Schedule`;
      content = `Class: ${className}\nSubject: ${subjName}\nDate: ${dateStr}\nTime: ${schedule.startTime} - ${schedule.endTime}\nInstructions:\n${schedule.instructions || 'Please complete the syllabus before the examination.'}\n\nNote: The schedule was recently updated. Please take note of the new timings.`;
    }

    // Include the tag marker for identification/correlation
    content += `\n\n<!-- examScheduleId: ${schedule.id} -->`;

    // Find existing institutional announcement for this exam schedule
    const existing = await this.prisma.announcement.findFirst({
      where: {
        tenantId,
        audienceType: 'INSTITUTION',
        content: { contains: `<!-- examScheduleId: ${schedule.id} -->` }
      }
    });

    // Find a staff profile under this tenant to use as the required creator relation
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId }
    });
    if (!staff) return;

    if (existing) {
      // Update existing announcement
      await this.prisma.announcement.update({
        where: { id: existing.id },
        data: {
          title,
          content,
          priority: (actionName === 'cancelled' || schedule.status === 'Cancelled') ? 'High' : 'Medium',
          readStatus: [] as any,
          classSection: schedule.classSectionId ? { connect: { id: schedule.classSectionId } } : { disconnect: true }
        }
      });
    } else {
      // Create new institutional announcement
      await this.prisma.announcement.create({
        data: {
          title,
          content,
          audienceType: 'INSTITUTION',
          priority: (actionName === 'cancelled' || schedule.status === 'Cancelled') ? 'High' : 'Medium',
          readStatus: [] as any,
          classSection: schedule.classSectionId ? { connect: { id: schedule.classSectionId } } : undefined,
          tenant: { connect: { id: tenantId } },
          teacher: { connect: { id: staff.id } }
        }
      });
    }
  }

  // --- CRUD Core APIs ---

  async create(dto: CreateExamScheduleDto, userId: string) {
    const tenantId = this.getTenantId();
    
    await this.validateSchedule(dto);

    const startMin = this.parseTimeToMinutes(dto.startTime);
    const endMin = this.parseTimeToMinutes(dto.endTime);
    const duration = endMin - startMin;

    const schedule = await this.prisma.examSchedule.create({
      data: {
        tenantId,
        academicYearId: dto.academicYearId,
        examName: dto.examName,
        classSectionId: dto.classSectionId,
        subjectId: dto.subjectId,
        examDate: new Date(dto.examDate),
        startTime: dto.startTime,
        endTime: dto.endTime,
        duration,
        examHall: dto.examHall || null,
        instructions: dto.instructions || null,
        status: dto.status || 'Draft',
        createdBy: userId
      }
    });

    await this.notifyTeachers(schedule, 'scheduled');

    return schedule;
  }

  async createBulk(dto: BulkCreateDto, userId: string) {
    const tenantId = this.getTenantId();

    // Validate all records before saving to DB
    for (const item of dto.schedules) {
      await this.validateSchedule(item);
    }

    const createdSchedules = [];
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.schedules) {
        const startMin = this.parseTimeToMinutes(item.startTime);
        const endMin = this.parseTimeToMinutes(item.endTime);
        const duration = endMin - startMin;

        const schedule = await tx.examSchedule.create({
          data: {
            tenantId,
            academicYearId: item.academicYearId,
            examName: item.examName,
            classSectionId: item.classSectionId,
            subjectId: item.subjectId,
            examDate: new Date(item.examDate),
            startTime: item.startTime,
            endTime: item.endTime,
            duration,
            examHall: item.examHall || null,
            instructions: item.instructions || null,
            status: item.status || 'Draft',
            createdBy: userId
          }
        });
        createdSchedules.push(schedule);
      }
    });

    for (const schedule of createdSchedules) {
      await this.notifyTeachers(schedule, 'scheduled');
    }

    return createdSchedules;
  }

  async update(id: string, dto: UpdateExamScheduleDto) {
    const tenantId = this.getTenantId();
    
    const existing = await this.prisma.examSchedule.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Exam schedule not found');
    }

    // Merge parameters for validation check
    const checkDto: CreateExamScheduleDto = {
      examName: dto.examName !== undefined ? dto.examName : existing.examName,
      academicYearId: dto.academicYearId !== undefined ? dto.academicYearId : existing.academicYearId,
      classSectionId: dto.classSectionId !== undefined ? dto.classSectionId : existing.classSectionId,
      subjectId: dto.subjectId !== undefined ? dto.subjectId : existing.subjectId,
      examDate: dto.examDate !== undefined ? dto.examDate : existing.examDate.toISOString().split('T')[0],
      startTime: dto.startTime !== undefined ? dto.startTime : existing.startTime,
      endTime: dto.endTime !== undefined ? dto.endTime : existing.endTime,
      examHall: dto.examHall !== undefined ? dto.examHall : (existing.examHall || undefined),
      instructions: dto.instructions !== undefined ? dto.instructions : (existing.instructions || undefined),
      status: dto.status !== undefined ? dto.status : existing.status,
    };

    await this.validateSchedule(checkDto, id);

    const startMin = this.parseTimeToMinutes(checkDto.startTime);
    const endMin = this.parseTimeToMinutes(checkDto.endTime);
    const duration = endMin - startMin;

    const updated = await this.prisma.examSchedule.update({
      where: { id },
      data: {
        examName: checkDto.examName,
        academicYearId: checkDto.academicYearId,
        classSectionId: checkDto.classSectionId,
        subjectId: checkDto.subjectId,
        examDate: new Date(checkDto.examDate),
        startTime: checkDto.startTime,
        endTime: checkDto.endTime,
        duration,
        examHall: checkDto.examHall || null,
        instructions: checkDto.instructions || null,
        status: checkDto.status,
      }
    });

    if (updated.status === 'Cancelled') {
      await this.notifyTeachers(updated, 'cancelled');
    } else {
      await this.notifyTeachers(updated, 'updated');
    }

    return updated;
  }

  async updateBulk(dto: BulkStatusDto) {
    const tenantId = this.getTenantId();
    const updated = [];

    for (const id of dto.ids) {
      const existing = await this.prisma.examSchedule.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) continue;

      const schedule = await this.prisma.examSchedule.update({
        where: { id },
        data: { status: dto.status }
      });
      updated.push(schedule);

      if (schedule.status === 'Cancelled') {
        await this.notifyTeachers(schedule, 'cancelled');
      } else {
        await this.notifyTeachers(schedule, 'updated');
      }
    }

    return updated;
  }

  async delete(id: string) {
    const tenantId = this.getTenantId();
    const existing = await this.prisma.examSchedule.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Exam schedule not found');
    }

    await this.prisma.examSchedule.delete({ where: { id } });

    await this.notifyTeachers(existing, 'cancelled');

    return { success: true };
  }

  async deleteBulk(dto: BulkDeleteDto) {
    const tenantId = this.getTenantId();
    
    for (const id of dto.ids) {
      const existing = await this.prisma.examSchedule.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== tenantId) continue;

      await this.prisma.examSchedule.delete({ where: { id } });

      await this.notifyTeachers(existing, 'cancelled');
    }

    return { success: true };
  }

  async findOne(id: string) {
    const tenantId = this.getTenantId();
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id },
      include: {
        classSection: {
          include: { class: true, section: true }
        },
        subject: true,
        academicYear: true
      }
    });

    if (!schedule || schedule.tenantId !== tenantId) {
      throw new NotFoundException('Exam schedule not found');
    }

    return schedule;
  }

  async findAll(query: any, user: any) {
    const tenantId = this.getTenantId();
    
    const whereClause: any = { tenantId };
    
    if (query.academicYearId) {
      whereClause.academicYearId = query.academicYearId;
    }
    if (query.classSectionId) {
      whereClause.classSectionId = query.classSectionId;
    }
    if (query.subjectId) {
      whereClause.subjectId = query.subjectId;
    }
    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.search) {
      whereClause.examName = { contains: query.search, mode: 'insensitive' };
    }
    if (query.upcoming === 'true') {
      whereClause.examDate = { gte: new Date() };
      whereClause.status = { in: ['Published', 'Completed'] };
    }
    
    if (user.role === 'TEACHER') {
      // Teachers only see schedules that are Published, Completed, or Cancelled
      if (!query.status) {
        whereClause.status = { in: ['Published', 'Completed', 'Cancelled'] };
      }
      
      const staff = await this.prisma.staffProfile.findFirst({
        where: { userId: user.id, tenantId },
        include: {
          classSections: { select: { id: true } },
          teacherAssignments: { select: { classSectionId: true, subjectId: true } }
        }
      });
      
      if (!staff) {
        return [];
      }
      
      const advisorClassIds = staff.classSections.map(cs => cs.id);
      const assignedClassIds = staff.teacherAssignments.map(ta => ta.classSectionId);
      const classSectionIds = Array.from(new Set([...advisorClassIds, ...assignedClassIds]));
      const subjectIds = Array.from(new Set(staff.teacherAssignments.map(ta => ta.subjectId)));
      
      whereClause.classSectionId = { in: classSectionIds };
      whereClause.subjectId = { in: subjectIds };
    }
    
    return this.prisma.examSchedule.findMany({
      where: whereClause,
      include: {
        classSection: {
          include: { class: true, section: true }
        },
        subject: true,
        academicYear: true
      },
      orderBy: { examDate: 'asc' }
    });
  }
}
