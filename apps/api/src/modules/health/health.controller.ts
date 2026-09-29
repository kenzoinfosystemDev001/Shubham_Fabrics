import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    const startTime = Date.now();
    let dbStatus = 'healthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e: any) {
      dbStatus = `unhealthy: ${e.message}`;
    }
    const latencyMs = Date.now() - startTime;

    return {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      service: 'Subham Fabrics MES API Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      database: {
        status: dbStatus,
        latencyMs,
      },
    };
  }
}
