import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'edutrack-super-secret-key-change-in-production-19823612',
    });
  }

  private userCache = new Map<string, { user: any; expiresAt: number }>();

  async validate(payload: any) {
    const activeTenantId = TenantContext.getTenantId();
    const nowTime = Date.now();
    
    let user: any;
    const cached = this.userCache.get(payload.sub);
    if (cached && cached.expiresAt > nowTime) {
      user = cached.user;
    } else {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (user) {
        this.userCache.set(payload.sub, {
          user,
          expiresAt: nowTime + 30 * 1000,
        });
      }
    }
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is disabled or does not exist');
    }
    
    // Enforce tenant boundary safety checks for multi-tenancy
    if (activeTenantId && user.tenantId !== activeTenantId && user.role !== 'SUPER_ADMIN') {
      throw new UnauthorizedException('Unauthorized access: token tenant mismatch');
    }

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenantId: user.tenantId,
      avatarUrl: user.avatarUrl,
    };
  }
}
