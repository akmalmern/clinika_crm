import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from './../src/health/health.controller';
import { PrismaService } from './../src/core/prisma/prisma.service';
import { RedisService } from './../src/core/redis/redis.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';

/**
 * Health e2e — infratuzilmasiz (DB/Redis mock) ishlaydi, shuning uchun CI'da
 * ham deterministik. HTTP qatlami + standart javob konverti (ResponseInterceptor)
 * tekshiriladi.
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const prismaMock = { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) };
  const redisMock = { raw: { ping: jest.fn().mockResolvedValue('PONG') } };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  interface ApiEnvelope {
    success: boolean;
    data: { status: string; checks?: Record<string, string> };
  }

  it('/health (GET) -> standart konvert + status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = res.body as ApiEnvelope;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it("/ready (GET) -> DB va Redis up bo'lsa ready", async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(200);
    const body = res.body as ApiEnvelope;
    expect(body.data.status).toBe('ready');
    expect(body.data.checks).toEqual({ database: 'up', redis: 'up' });
  });
});
