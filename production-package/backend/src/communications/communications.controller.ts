import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('communications')
export class CommunicationsController {
  constructor(private communicationsService: CommunicationsService) {}

  @Post()
  async send(@Body() data: any) {
    return this.communicationsService.sendNotification(data);
  }

  @Get('user/:recipientId')
  async getForUser(@Param('recipientId') recipientId: string) {
    return this.communicationsService.getNotifications(recipientId);
  }

  @Post(':id/read')
  async read(@Param('id') id: string) {
    return this.communicationsService.markAsRead(id);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return this.communicationsService.deleteNotification(id);
  }

  @Post('clear-read/:recipientId')
  async clearReadNotifications(@Param('recipientId') recipientId: string) {
    return this.communicationsService.clearReadNotifications(recipientId);
  }
}
