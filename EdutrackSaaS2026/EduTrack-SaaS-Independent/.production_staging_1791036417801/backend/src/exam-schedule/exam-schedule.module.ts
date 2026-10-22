import { Module } from '@nestjs/common';
import { ExamScheduleService } from './exam-schedule.service';
import { ExamScheduleController } from './exam-schedule.controller';
import { PrismaService } from '../prisma.service';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [CommunicationsModule],
  controllers: [ExamScheduleController],
  providers: [ExamScheduleService, PrismaService],
  exports: [ExamScheduleService],
})
export class ExamScheduleModule {}
