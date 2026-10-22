import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransportService } from './transport.service';
import { TransportController } from './transport.controller';
import { TransportTrackingGateway } from './transport.gateway';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'edutrack-super-secret-key-change-in-production-19823612',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TransportController],
  providers: [TransportService, TransportTrackingGateway, PrismaService],
  exports: [TransportService],
})
export class TransportModule {}
