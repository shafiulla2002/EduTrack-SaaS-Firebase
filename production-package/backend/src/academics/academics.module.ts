import { Module } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { AcademicsController, AcademicYearsAliasController } from './academics.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AcademicsService, PrismaService],
  controllers: [AcademicsController, AcademicYearsAliasController],
  exports: [AcademicsService],
})
export class AcademicsModule {}
