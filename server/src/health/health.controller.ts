import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../core/prisma/prisma.service';
import { RedisService } from '../core/redis/redis.service';

/**
 * Health-check endpoint'lari (spec 10-bo'lim — Docker/Nginx/K8s uchun).
 *  - /health : liveness (jarayon tirikmi)
 *  - /ready  : readiness (DB + Redis bog'lanishi tayyormi)
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness — jarayon ishlayaptimi' })
  health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness — DB va Redis tayyormi' })
  async ready() {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
      redis: 'down',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    try {
      const pong = await this.redis.raw.ping();
      checks.redis = pong === 'PONG' ? 'up' : 'down';
    } catch {
      checks.redis = 'down';
    }

    const ready = checks.database === 'up' && checks.redis === 'up';
    return { status: ready ? 'ready' : 'degraded', checks };
  }
}
