import { Module } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TimetableController],
  providers: [TimetableService, PrismaService],
  exports: [TimetableService],
})
export class TimetableModule {}
