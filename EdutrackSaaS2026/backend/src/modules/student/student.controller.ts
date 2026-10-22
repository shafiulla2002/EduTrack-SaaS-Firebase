import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { StudentService } from './student.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  findAll(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.studentService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.studentService.findOne(id, tenantId);
  }
}
