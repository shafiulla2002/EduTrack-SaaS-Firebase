import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get()
  findAll(@Request() req) {
    const tenantId = req.user.tenantId;
    return this.teacherService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.teacherService.findOne(id, tenantId);
  }

  @Post()
  create(@Body() createDto: CreateTeacherDto, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.teacherService.create(tenantId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateTeacherDto, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.teacherService.update(id, tenantId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const tenantId = req.user.tenantId;
    return this.teacherService.remove(id, tenantId);
  }
}
