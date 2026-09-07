import { Module } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { AcademicsController } from './academics.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AcademicsService, PrismaService],
  controllers: [AcademicsController],
  exports: [AcademicsService],
})
export class AcademicsModule {}
