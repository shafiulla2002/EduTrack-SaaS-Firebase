import { Controller, Get, Post, Body, Param, UseGuards, Delete, Req, BadRequestException } from '@nestjs/common';
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

  @Post('register-device-token')
  async registerDeviceToken(
    @Req() req: any,
    @Body() body: { token: string; platform?: string; deviceInfo?: string },
  ) {
    const userId = req.user.id || req.user.sub;
    const tenantId = req.user.tenantId;
    if (!body?.token) {
      throw new BadRequestException('Device token is required');
    }
    return this.communicationsService.registerDeviceToken(
      userId,
      tenantId,
      body.token,
      body.platform || 'ANDROID',
      body.deviceInfo,
    );
  }

  @Post('unregister-device-token')
  async unregisterDeviceToken(@Body() body: { token: string }) {
    if (!body?.token) {
      throw new BadRequestException('Device token is required');
    }
    return this.communicationsService.unregisterDeviceToken(body.token);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const tenantId = req.user.tenantId;
    return this.communicationsService.getUnreadCount(userId, tenantId);
  }

  @Get('user-notifications')
  async getMyNotifications(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const tenantId = req.user.tenantId;
    return this.communicationsService.getNotifications(userId, tenantId);
  }

  @Get('user/:recipientId')
  async getForUser(@Req() req: any, @Param('recipientId') recipientId: string) {
    const tenantId = req.user?.tenantId;
    return this.communicationsService.getNotifications(recipientId, tenantId);
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

