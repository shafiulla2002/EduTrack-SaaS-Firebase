import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [SupportService, PrismaService],
  controllers: [SupportController],
})
export class SupportModule {}
