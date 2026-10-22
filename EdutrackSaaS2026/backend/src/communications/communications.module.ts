import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [CommunicationsService, PrismaService],
  controllers: [CommunicationsController],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}

