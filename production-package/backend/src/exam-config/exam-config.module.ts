import { Module } from '@nestjs/common';
import { ExamConfigService } from './exam-config.service';
import { ExamConfigController } from './exam-config.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ExamConfigController],
  providers: [ExamConfigService, PrismaService],
  exports: [ExamConfigService],
})
export class ExamConfigModule {}
