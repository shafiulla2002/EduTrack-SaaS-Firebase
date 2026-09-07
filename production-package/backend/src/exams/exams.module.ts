import { Module, forwardRef } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { PrismaService } from '../prisma.service';
import { ExamConfigModule } from '../exam-config/exam-config.module';

@Module({
  imports: [forwardRef(() => ExamConfigModule)],
  providers: [ExamsService, PrismaService],
  controllers: [ExamsController],
  exports: [ExamsService],
})
export class ExamsModule {}
