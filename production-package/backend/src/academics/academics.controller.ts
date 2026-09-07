import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('academics')
export class AcademicsController {
  constructor(private academicsService: AcademicsService) {}

  // ── Academic Years ──────────────────────────────────────────────────────────
  @Post('academic-years')
  async createYear(
    @Body('name') name: string,
    @Body('startDate') startDate: Date,
    @Body('endDate') endDate: Date,
    @Body('isActive') isActive: boolean,
  ) {
    return this.academicsService.createAcademicYear(name, startDate, endDate, isActive);
  }

  @Get('academic-years')
  async getYears() {
    return this.academicsService.getAcademicYears();
  }

  @Patch('academic-years/:id/toggle')
  async toggleYearActive(@Param('id') id: string) {
    return this.academicsService.toggleAcademicYearActive(id);
  }

  // ── Classes ────────────────────────────────────────────────────────────────
  @Post('classes')
  async createClass(@Body('name') name: string, @Body('academicYearId') academicYearId: string) {
    return this.academicsService.createClass(name, academicYearId);
  }

  @Get('classes')
  async getClasses(@Query('academicYearId') academicYearId?: string) {
    return this.academicsService.getClasses(academicYearId);
  }

  @Get('classes/:id/student-count')
  async getClassStudentCount(@Param('id') id: string) {
    return this.academicsService.getClassStudentCount(id);
  }

  @Delete('classes/:id')
  async deleteClass(@Param('id') id: string) {
    return this.academicsService.deleteClass(id);
  }

  // ── Sections ───────────────────────────────────────────────────────────────
  @Post('sections')
  async createSection(@Body('name') name: string) {
    return this.academicsService.createSection(name);
  }

  @Get('sections')
  async getSections() {
    return this.academicsService.getSections();
  }

  // ── Class Sections ─────────────────────────────────────────────────────────
  @Post('class-sections')
  async createClassSection(
    @Body('classId') classId: string,
    @Body('sectionId') sectionId: string,
    @Body('teacherId') teacherId?: string,
  ) {
    return this.academicsService.createClassSection(classId, sectionId, teacherId);
  }

  @Get('class-sections')
  async getClassSections() {
    return this.academicsService.getClassSections();
  }

  // ── Subjects ───────────────────────────────────────────────────────────────
  @Post('subjects')
  async createSubject(@Body('name') name: string) {
    return this.academicsService.createSubject(name);
  }

  @Get('subjects')
  async getSubjects() {
    return this.academicsService.getSubjects();
  }

  // ── Class Section Subjects ─────────────────────────────────────────────────
  @Post('class-sections/:classSectionId/subjects')
  async addSubjectToClassSection(
    @Param('classSectionId') classSectionId: string,
    @Body('subjectId') subjectId: string,
  ) {
    return this.academicsService.addSubjectToClassSection(classSectionId, subjectId);
  }

  @Get('class-sections/:classSectionId/subjects')
  async getClassSectionSubjects(@Param('classSectionId') classSectionId: string) {
    return this.academicsService.getClassSubjects(classSectionId);
  }

  @Delete('class-sections/:classSectionId/subjects/:subjectId')
  async removeSubjectFromClassSection(
    @Param('classSectionId') classSectionId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.academicsService.removeSubjectFromClassSection(classSectionId, subjectId);
  }

  // ── Timetable Timings ──────────────────────────────────────────────────────
  @Post('period-timings')
  async createTiming(
    @Body('periodNumber') periodNumber: number,
    @Body('startTime') startTime: string,
    @Body('endTime') endTime: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.academicsService.createPeriodTiming(periodNumber, startTime, endTime, isActive);
  }

  @Get('period-timings')
  async getTimings() {
    return this.academicsService.getPeriodTimings();
  }

  // ── Scheduled Periods ──────────────────────────────────────────────────────
  @Post('periods')
  async createPeriod(@Body() data: any) {
    return this.academicsService.createPeriod(data);
  }

  @Get('class-sections/:classSectionId/periods')
  async getPeriodsByClassSection(@Param('classSectionId') classSectionId: string) {
    return this.academicsService.getPeriodsByClassSection(classSectionId);
  }

  @Get('teachers/:teacherId/periods')
  async getPeriodsByTeacher(@Param('teacherId') teacherId: string) {
    return this.academicsService.getPeriodsByTeacher(teacherId);
  }
}

