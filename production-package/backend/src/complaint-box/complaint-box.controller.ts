// src/complaint-box/complaint-box.controller.ts
import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards } from '@nestjs/common';
import { ComplaintBoxService } from './complaint-box.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBehaviorDto } from './dto/create-behavior.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('complaint-box')
export class ComplaintBoxController {
  constructor(private readonly complaintBoxService: ComplaintBoxService) {}

  @Get('current-teacher')
  getCurrentTeacher() {
    return this.complaintBoxService.getCurrentTeacher();
  }

  @Get('student-classes')
  getStudentClasses() {
    return this.complaintBoxService.getStudentClasses();
  }

  @Get('teachers')
  getTeachers() {
    return this.complaintBoxService.getTeachers();
  }

  @Get('students-by-class/:classSectionId')
  getStudentsByClass(@Param('classSectionId') classSectionId: string) {
    return this.complaintBoxService.getStudentsByClass(classSectionId);
  }

  @Get('search-students')
  searchStudents(
    @Query('searchTerm') searchTerm?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.complaintBoxService.searchStudents(searchTerm, classId, sectionId);
  }

  @Post('submit-behavior')
  submitStudentBehavior(@Body() dto: CreateBehaviorDto) {
    return this.complaintBoxService.submitStudentBehavior(dto);
  }

  @Get('academic-years')
  getAcademicYears() {
    return this.complaintBoxService.getAcademicYears();
  }

  @Get('pending-cases')
  getPendingCases(@Query('academicYear') academicYear?: string) {
    return this.complaintBoxService.getPendingCases(academicYear);
  }

  @Get('student-cases/:studentId')
  getStudentCases(@Param('studentId') studentId: string, @Query('academicYear') academicYear?: string) {
    return this.complaintBoxService.getStudentCases(studentId, academicYear);
  }

  @Patch('case-status/:caseId')
  updateCaseStatus(@Param('caseId') caseId: string, @Body() dto: UpdateCaseStatusDto) {
    return this.complaintBoxService.updateCaseStatus(caseId, dto);
  }

  @Get('student-stats/:studentId')
  getStudentStats(@Param('studentId') studentId: string) {
    return this.complaintBoxService.getStudentStats(studentId);
  }

  @Patch('behavior/:caseId')
  updateBehavior(@Param('caseId') caseId: string, @Body() dto: CreateBehaviorDto) {
    return this.complaintBoxService.updateBehavior(caseId, dto);
  }

  @Delete('behavior/:caseId')
  deleteBehavior(@Param('caseId') caseId: string) {
    return this.complaintBoxService.deleteBehavior(caseId);
  }

  @Get('parent-complaints')
  getParentComplaints(@Query('status') status?: string) {
    return this.complaintBoxService.getParentComplaints(status);
  }

  @Patch('parent-complaints/:id/status')
  updateParentComplaintStatus(@Param('id') id: string, @Body() data: any) {
    return this.complaintBoxService.updateParentComplaintStatus(id, data);
  }
}


