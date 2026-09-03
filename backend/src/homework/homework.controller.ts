import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  async getHomeworks(@Req() req: any) {
    return this.homeworkService.getHomeworks(req.user.sub, req.user.role);
  }

  @Get('classes')
  async getClasses(@Req() req: any) {
    return this.homeworkService.getHomeworkClasses(req.user.sub, req.user.role);
  }

  @Post()
  async createHomework(@Req() req: any, @Body() data: any) {
    return this.homeworkService.createHomework(req.user.sub, req.user.role, data);
  }

  @Put(':id')
  async updateHomework(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.homeworkService.updateHomework(req.user.sub, req.user.role, id, data);
  }

  @Delete(':id')
  async deleteHomework(@Req() req: any, @Param('id') id: string) {
    return this.homeworkService.deleteHomework(req.user.sub, req.user.role, id);
  }

  @Get(':id/submissions')
  async getSubmissions(@Req() req: any, @Param('id') id: string) {
    return this.homeworkService.getHomeworkSubmissions(req.user.sub, req.user.role, id);
  }
}
