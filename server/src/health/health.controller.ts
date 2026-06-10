import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../core/prisma/prisma.service';
import { RedisService } from '../core/redis/redis.service';
import { StorageService } from '../core/storage/storage.service';

type Check = 'up' | 'down';

/**
 * Health-check endpoint'lari (spec 10 — Docker/Nginx/K8s uchun).
 *  - /health : liveness (jarayon tirikmi) — har doim 200.
 *  - /ready  : readiness (DB + Redis + MinIO bog'lanishi) — tayyor bo'lmasa 503.
 *
 * 503 muhim: yuk balanslagich (Nginx/K8s) tayyor bo'lmagan instansiyaga
 * trafik yubormaydi.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
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
  @ApiOperation({ summary: 'Readiness — DB, Redis va MinIO tayyormi' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const [database, redis, storage] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const checks: Record<string, Check> = { database, redis, storage };
    const ready = database === 'up' && redis === 'up' && storage === 'up';
    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: ready ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<Check> {
    try {
      const pong = await this.redis.raw.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async checkStorage(): Promise<Check> {
    try {
      return (await this.storage.ping()) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
