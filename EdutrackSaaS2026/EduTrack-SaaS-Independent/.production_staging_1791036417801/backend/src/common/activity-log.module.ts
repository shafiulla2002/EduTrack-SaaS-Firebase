import { Module, Global } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';
import { RoleFilterHelper } from './role-filter.helper';
import { PrismaService } from '../prisma.service';

/**
 * Global common module — exported providers are available in every module
 * without needing to import CommonModule explicitly.
 */
@Global()
@Module({
  providers: [ActivityLogService, RoleFilterHelper, PrismaService],
  controllers: [ActivityLogController],
  exports: [ActivityLogService, RoleFilterHelper],
})
export class ActivityLogModule {}
