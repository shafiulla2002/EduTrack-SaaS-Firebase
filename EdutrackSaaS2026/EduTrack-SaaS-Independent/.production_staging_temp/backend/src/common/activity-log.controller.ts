import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private activityLogService: ActivityLogService) {}

  @Get()
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityName') entityName?: string,
  ) {
    return this.activityLogService.getLogs(userId, action, entityName);
  }
}
