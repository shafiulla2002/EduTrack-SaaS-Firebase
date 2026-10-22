import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards, Query } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateClassDto,
  CreateSectionDto,
  CreateSubjectDto,
  BulkSubjectsInputDto,
  CreateTeacherWithSkillsDto,
  BulkTeachersInputDto,
  CreateClassSectionDto,
  UpdateTeacherAssignmentDto,
  SaveSubstituteDto,
  SaveTimetablePeriodsDto,
  PeriodTimingDto,
} from './dto/timetable.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get('academic-years')
  getAcademicYears(@Request() req) {
    return this.timetableService.getAcademicYears(req.user.tenantId);
  }

  @Get('classes')
  getClasses(@Request() req) {
    return this.timetableService.getClasses(req.user.tenantId);
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto, @Request() req) {
    return this.timetableService.createClass(req.user.tenantId, dto.name);
  }

  @Delete('classes/:id')
  deleteClass(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteClass(req.user.tenantId, id);
  }

  @Get('sections')
  getSections(@Request() req) {
    return this.timetableService.getSections(req.user.tenantId);
  }

  @Post('sections')
  createSection(@Body() dto: CreateSectionDto, @Request() req) {
    return this.timetableService.createSection(req.user.tenantId, dto.name);
  }

  @Delete('sections/:id')
  deleteSection(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteSection(req.user.tenantId, id);
  }

  @Get('period-timings')
  getPeriodTimings(@Request() req) {
    return this.timetableService.getPeriodTimings(req.user.tenantId);
  }

  @Post('period-timings')
  savePeriodTimings(@Body() dto: PeriodTimingDto[], @Request() req) {
    return this.timetableService.savePeriodTimings(req.user.tenantId, dto);
  }

  @Get('subjects')
  getSubjects(@Request() req) {
    return this.timetableService.getSubjects(req.user.tenantId);
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto, @Request() req) {
    return this.timetableService.createSubject(req.user.tenantId, dto);
  }

  @Post('subjects/bulk')
  bulkCreateSubjects(@Body() dto: BulkSubjectsInputDto, @Request() req) {
    return this.timetableService.bulkCreateSubjects(req.user.tenantId, dto.subjects);
  }

  @Get('teachers/subject')
  getTeachersForSubject(@Query('subjectIds') subjectIds: string, @Request() req) {
    const ids = subjectIds ? subjectIds.split(',') : [];
    return this.timetableService.getTeachersForSubject(req.user.tenantId, ids);
  }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherWithSkillsDto, @Request() req) {
    return this.timetableService.createTeacherWithSkills(req.user.tenantId, dto);
  }

  @Post('teachers/bulk')
  bulkCreateTeachers(@Body() dto: BulkTeachersInputDto, @Request() req) {
    return this.timetableService.bulkCreateTeachers(req.user.tenantId, dto.teachers);
  }

  @Get('workload/summary')
  getWorkloadSummary(@Query('academicYearId') academicYearId: string, @Request() req) {
    return this.timetableService.getWorkloadSummary(req.user.tenantId, academicYearId);
  }

  @Get('workload/teachers')
  getAllTeacherWorkloads(@Request() req) {
    return this.timetableService.getAllTeacherWorkloads(req.user.tenantId);
  }

  @Get('workload/classes')
  getAllClassWorkloads(@Request() req) {
    return this.timetableService.getAllClassWorkloads(req.user.tenantId);
  }

  @Get('workload/teacher/:id')
  getTeacherWorkload(@Param('id') id: string, @Request() req) {
    return this.timetableService.getTeacherWorkload(req.user.tenantId, id);
  }

  @Get('workload/class-section/:id')
  getClassSectionWorkload(@Param('id') id: string, @Request() req) {
    return this.timetableService.getClassSectionWorkload(req.user.tenantId, id);
  }

  @Patch('assignments/:id')
  updateTeacherAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAssignmentDto,
    @Request() req
  ) {
    return this.timetableService.updateTeacherAssignment(
      req.user.tenantId,
      id,
      dto.newTeacherId,
      dto.periodsPerWeek
    );
  }

  @Delete('assignments/:id')
  deleteTeacherAssignment(@Param('id') id: string, @Request() req) {
    return this.timetableService.deleteTeacherAssignment(req.user.tenantId, id);
  }

  @Post('class-sections')
  createClassSection(@Body() dto: CreateClassSectionDto, @Request() req) {
    return this.timetableService.createClassSection(req.user.tenantId, dto);
  }

  @Get('class-sections')
  getAllClassSections(@Request() req) {
    return this.timetableService.getAllClassSections(req.user.tenantId);
  }

  @Get('teachers')
  getAllTeachers(@Request() req) {
    return this.timetableService.getAllTeachers(req.user.tenantId);
  }

  @Get('class/:classSectionId/periods')
  getPeriodsForClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string,
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.timetableService.getTimetableForClass(
      req.user.tenantId,
      classSectionId,
      academicYearId,
      startDate,
      endDate
    );
  }

  @Get('teacher/:teacherId/periods')
  getPeriodsForTeacher(
    @Param('teacherId') teacherId: string,
    @Query('gaps') gaps: string,
    @Request() req
  ) {
    if (gaps === 'true') {
      return this.timetableService.getPeriodsForTeacherWithGaps(req.user.tenantId, teacherId);
    }
    return this.timetableService.getPeriodsForTeacher(req.user.tenantId, teacherId);
  }

  @Get('teacher/:teacherId/leaser-periods')
  getLeaserPeriodsForTeacher(@Param('teacherId') teacherId: string, @Request() req) {
    return this.timetableService.getLeaserPeriodsForTeacher(req.user.tenantId, teacherId);
  }

  @Post('periods/substitute')
  saveSubstituteForPeriod(@Body() dto: SaveSubstituteDto, @Request() req) {
    return this.timetableService.saveSubstituteForPeriod(
      req.user.tenantId,
      dto.periodId,
      dto.substituteTeacherId
    );
  }

  @Post('periods/save')
  saveTimetablePeriods(@Body() dto: SaveTimetablePeriodsDto, @Request() req) {
    return this.timetableService.saveTimetablePeriods(req.user.tenantId, dto);
  }
}
