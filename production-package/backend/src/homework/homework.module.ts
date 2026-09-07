import { Module } from '@nestjs/common';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [HomeworkController],
  providers: [HomeworkService, PrismaService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
