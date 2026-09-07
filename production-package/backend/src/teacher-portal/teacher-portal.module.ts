import { Module } from '@nestjs/common';
import { TeacherPortalController } from './teacher-portal.controller';
import { TeacherPortalService } from './teacher-portal.service';
import { PrismaService } from '../prisma.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [AttendanceModule, ExamsModule],
  controllers: [TeacherPortalController],
  providers: [
    TeacherPortalService,
    PrismaService,
  ],
})
export class TeacherPortalModule {}
