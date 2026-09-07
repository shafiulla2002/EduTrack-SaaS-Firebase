import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete, Req, BadRequestException, Patch } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
@Controller('students')
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Post()
  async create(@Body() data: any) {
    return this.studentsService.createStudent(data);
  }

  @Get()
  async search(
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : undefined;
    const l = limit ? parseInt(limit, 10) : undefined;
    return this.studentsService.searchStudents(search, classId, sectionId, academicYearId, p, l);
  }

  @Get('promotion-candidates')
  async getPromotionCandidates(
    @Query('sourceYearId') sourceYearId: string,
    @Query('className') className?: string,
    @Query('sectionName') sectionName?: string,
  ) {
    return this.studentsService.getPromotionCandidates(sourceYearId, className, sectionName);
  }

  @Post('promote')
  async promote(
    @Body('studentIds') studentIds: string[],
    @Body('sourceYearId') sourceYearId: string,
    @Body('targetYearId') targetYearId: string,
    @Body('targetClassName') targetClassName: string,
    @Body('targetSectionName') targetSectionName?: string,
  ) {
    return this.studentsService.promoteStudents({
      studentIds,
      sourceYearId,
      targetYearId,
      targetClassName,
      targetSectionName,
    });
  }

  @Post('promote/validate')
  async validatePromotion(
    @Body('studentIds') studentIds: string[],
    @Body('sourceYearId') sourceYearId: string,
  ) {
    return this.studentsService.validatePromotion({
      studentIds,
      sourceYearId,
    });
  }

  @Get('parents/all')
  async getParents() {
    return this.studentsService.getParents();
  }

  // ── Student Lifecycle Endpoints ──

  @Post('lifecycle/status')
  async updateLifecycleStatus(@Req() req: any, @Body() body: any) {
    const actorUserId = req.user.id || req.user.sub;
    return this.studentsService.updateStudentLifecycleStatus(actorUserId, body);
  }

  @Post('lifecycle/bulk-status')
  async bulkUpdateLifecycleStatus(@Req() req: any, @Body() body: any) {
    const actorUserId = req.user.id || req.user.sub;
    return this.studentsService.bulkUpdateStudentLifecycleStatus(actorUserId, body);
  }

  @Get('lifecycle/historical')
  async getHistoricalStudents(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('className') className?: string,
    @Query('sectionName') sectionName?: string,
  ) {
    return this.studentsService.getHistoricalStudents({
      status,
      search,
      academicYearId,
      className,
      sectionName,
    });
  }

  @Post('lifecycle/re-enroll')
  async reEnrollStudent(@Req() req: any, @Body() body: any) {
    const actorUserId = req.user.id || req.user.sub;
    return this.studentsService.reEnrollStudent(actorUserId, body);
  }

  @Get(':id/complete-history')
  async getCompleteStudentHistory(@Param('id') id: string) {
    return this.studentsService.getCompleteStudentHistory(id);
  }

  @Get(':id')
  async getDetails(
    @Param('id') id: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.studentsService.getStudentDetails(id, academicYearId);
  }

  @Patch(':id')
  async updateStudent(@Param('id') id: string, @Body() data: any) {
    return this.studentsService.updateStudent(id, data);
  }

  @Delete(':id')
  async deleteStudent(@Param('id') id: string) {
    return this.studentsService.deleteStudent(id);
  }

  @Post('bulk-delete')
  async bulkDelete(@Req() req: any, @Body('studentIds') studentIds: string[]) {
    if (!Array.isArray(studentIds)) {
      throw new BadRequestException('studentIds must be an array of strings');
    }
    const actorUserId = req.user.id;
    return this.studentsService.bulkDeleteStudents(studentIds, actorUserId);
  }

  @Post('import')
  async importBulk(@Body('students') students: any[]) {
    if (!Array.isArray(students)) {
      throw new Error('Students parameter must be an array');
    }
    return this.studentsService.importStudentsBulk(students);
  }
}

