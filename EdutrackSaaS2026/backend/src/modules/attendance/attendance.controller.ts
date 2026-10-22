import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Body() dto: CreateAttendanceDto, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.create(tenantId, {
      studentId: dto.studentId,
      date: dto.date,
      status: dto.status,
    });
  }

  @Get()
  findAll(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.findOne(id, tenantId);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.findByStudent(studentId, tenantId);
  }
}
