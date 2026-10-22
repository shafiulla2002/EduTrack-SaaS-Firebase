import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { randomUUID } from 'crypto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Check if domain or email already exists
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Email already in use');

    const existingTenant = await this.prisma.tenant.findUnique({ where: { subDomain: dto.domain.toLowerCase() } });
    if (existingTenant) throw new ConflictException('Domain already in use');

    // 2. Create Tenant and User in a transaction
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: randomUUID(),
          name: dto.school_name,
          subDomain: dto.domain.toLowerCase(),
          updatedAt: new Date(),
        },
      });

      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          tenantId: tenant.id,
          email: dto.email,
          passwordHash: hashedPassword,
          name: `${dto.first_name} ${dto.last_name}`,
          role: 'SCHOOL_ADMIN',
          updatedAt: new Date(),
        },
      });

      return {
        message: 'Institution registered successfully',
        tenant_id: tenant.id,
        user_id: user.id,
      };
    });
    
    // Assign free plan outside transaction to avoid issues
    await this.subscriptionService.assignFreePlanToNewTenant(result.tenant_id);
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { Tenant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      tenantId: user.tenantId 
    };

    let subscriptionStatus = 'ACTIVE';
    if (user.role === 'SCHOOL_ADMIN') {
      const sub = await this.subscriptionService.checkSubscriptionStatus(user.tenantId);
      subscriptionStatus = sub.status;
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.name.split(' ')[0] || '',
        last_name: user.name.split(' ').slice(1).join(' ') || '',
        role: user.role,
        tenant: user.Tenant,
        subscriptionStatus,
      },
    };
  }
}
