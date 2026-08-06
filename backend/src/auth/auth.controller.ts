import { Controller, Post, Body, Get, UseGuards, Req, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContext } from '../tenants/tenant.context';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  async sendOtp(@Body('phone') phone: string, @Body('portal') portal?: string) {
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }
    return this.authService.sendOtp(phone, portal);
  }

  @Post('verify-otp')
  async verifyOtp(
    @Body('phone') phone: string, 
    @Body('otpCode') otpCode: string,
    @Body('portal') portal?: string,
    @Body('generateCode') generateCode?: boolean
  ) {
    if (!phone || !otpCode) {
      throw new BadRequestException('Phone number and OTP code are required');
    }
    return this.authService.verifyOtp(phone, otpCode, portal, generateCode);
  }

  @Post('exchange-code')
  async exchangeCode(@Body('code') code: string) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.authService.exchangeCode(code);
  }

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Strict Target Portal Authorization Lock
    const targetPortal = body.targetPortal ? String(body.targetPortal).toUpperCase() : null;
    if (targetPortal === 'PLATFORM' && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Your account belongs to the School Portal. Please use https://app.edutrack.com (http://localhost:3000).'
      );
    }
    if (targetPortal === 'SCHOOL' && user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Your account belongs to the Platform Portal. Please use https://platform.edutrack.com (http://localhost:3002).'
      );
    }

    return this.authService.login(user);
  }



  @Post('register')
  async register(@Body() body: any) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return this.authService.register(body, tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return req.user;
  }
}
