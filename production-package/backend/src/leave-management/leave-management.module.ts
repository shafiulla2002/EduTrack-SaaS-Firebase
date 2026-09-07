import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeaveManagementController } from './leave-management.controller';
import { LeaveManagementService } from './leave-management.service';

@Module({
  controllers: [LeaveManagementController],
  providers: [LeaveManagementService, PrismaService],
  exports: [LeaveManagementService],
})
export class LeaveManagementModule {}
