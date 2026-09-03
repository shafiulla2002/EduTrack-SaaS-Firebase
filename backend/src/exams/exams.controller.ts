import { Controller, Get, Post, Put, Delete, Body, Query, UseGuards, Param, Req } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
@Controller('exams')
export class ExamsController {
  constructor(private examsService: ExamsService) {}

  @Post()
  async create(
    @Body('name') name: string,
    @Body('type') type: string,
    @Body('classSectionId') classSectionId: string,
    @Body('date') date: Date,
  ) {
    return this.examsService.createExam(name, type, classSectionId, date);
  }

  @Get()
  async getAll(@Query('classSectionId') classSectionId?: string) {
    return this.examsService.getExams(classSectionId);
  }

  @Get('classes')
  async getClasses(@Req() req: any, @Query('academicYearId') academicYearId?: string) {
    return this.examsService.getClasses(req.user.sub, req.user.role, academicYearId);
  }

  @Get('subjects')
  async getSubjects(@Req() req: any, @Query('classSectionId') classSectionId?: string) {
    return this.examsService.getSubjects(req.user.sub, req.user.role, classSectionId);
  }

  @Get('exam-types')
  async getExamTypes() {
    return this.examsService.getExamTypes();
  }

  @Get('exam-types/manage')
  async getExamTypesManage() {
    return this.examsService.getExamTypesManage();
  }

  @Post('exam-types')
  async createExamType(@Body('name') name: string) {
    return this.examsService.createExamType(name);
  }

  @Put('exam-types/:id')
  async updateExamType(@Param('id') id: string, @Body('name') name: string) {
    return this.examsService.updateExamType(id, name);
  }

  @Delete('exam-types/:id')
  async deleteExamType(@Param('id') id: string) {
    return this.examsService.deleteExamType(id);
  }

  @Get('marks-entry')
  async getMarksEntryList(
    @Req() req: any,
    @Query('subjectId') subjectId: string,
    @Query('examName') examName: string,
    @Query('classSectionId') classSectionId?: string,
    @Query('examId') examId?: string,
    @Query('subjectType') subjectType?: string,
  ) {
    return this.examsService.getStudentsForMarksEntry(
      subjectId,
      examName,
      classSectionId,
      examId,
      req.user.sub,
      req.user.role,
      subjectType,
    );
  }

  @Post('save-marks')
  async saveMarks(
    @Req() req: any,
    @Body('marks') marks: any[],
    @Body('examName') examName: string,
    @Body('classSectionId') classSectionId: string,
    @Body('subjectId') subjectId: string,
    @Body('subjectType') subjectType?: string,
  ) {
    if (!Array.isArray(marks)) {
      throw new Error('Marks must be an array');
    }
    return this.examsService.saveMarks(
      marks,
      examName,
      classSectionId,
      subjectId,
      req.user.sub,
      req.user.role,
      subjectType,
    );
  }

  @Get('grades-report')
  async getReport(
    @Query('classSectionId') classSectionId: string,
    @Query('examName') examName: string,
  ) {
    return this.examsService.getGradesReport(classSectionId, examName);
  }
}
