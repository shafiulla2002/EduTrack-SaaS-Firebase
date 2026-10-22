import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  async createSupport(
    @Body() dto: CreateSupportRequestDto,
    @Req() req: Request,
  ) {
    // Resolve client IP, prioritizing x-forwarded-for for requests behind a proxy
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || '127.0.0.1';

    const userAgent = req.headers['user-agent'] || 'Unknown User Agent';

    return this.supportService.createSupportRequest(dto, ipAddress, userAgent);
  }
}
