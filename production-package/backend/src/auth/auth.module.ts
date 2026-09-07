import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'edutrack-super-secret-key-change-in-production-19823612',
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRATION') || '9999d' 
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, PrismaService, FirebaseAdminService],
  controllers: [AuthController],
  exports: [AuthService, PassportModule, FirebaseAdminService, JwtModule],
})
export class AuthModule {}
