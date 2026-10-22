import { Module } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [TeachersService, PrismaService],
  controllers: [TeachersController],
  exports: [TeachersService],
})
export class TeachersModule {}
