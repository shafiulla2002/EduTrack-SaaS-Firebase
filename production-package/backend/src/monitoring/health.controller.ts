import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async checkHealth() {
    let dbStatus = 'HEALTHY';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'UNHEALTHY';
    }

    return {
      status: dbStatus === 'HEALTHY' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async checkReadiness() {
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }
}
