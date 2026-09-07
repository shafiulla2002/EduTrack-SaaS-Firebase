// src/complaint-box/complaint-box.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ComplaintBoxService } from './complaint-box.service';
import { ComplaintBoxController } from './complaint-box.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [],
  providers: [ComplaintBoxService, PrismaService],
  controllers: [ComplaintBoxController],
  exports: [ComplaintBoxService],
})
export class ComplaintBoxModule {}
