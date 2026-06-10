import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from './../src/health/health.controller';
import { PrismaService } from './../src/core/prisma/prisma.service';
import { RedisService } from './../src/core/redis/redis.service';
import { StorageService } from './../src/core/storage/storage.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';

/**
 * Health e2e (spec 10) — infratuzilmasiz (DB/Redis/MinIO mock), CI'da deterministik.
 *  - /health har doim 200 (liveness).
 *  - /ready: DB+Redis+MinIO up -> 200 ready; biror biri down -> 503 degraded.
 * Standart javob konverti (ResponseInterceptor) ham tekshiriladi.
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const prismaMock = { $queryRaw: jest.fn() };
  const redisMock = { raw: { ping: jest.fn() } };
  const storageMock = { ping: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Har testdan oldin — sog'lom (hammasi up) default holat.
  beforeEach(() => {
    prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    redisMock.raw.ping.mockResolvedValue('PONG');
    storageMock.ping.mockResolvedValue(true);
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

  it("/ready (GET) -> DB, Redis va MinIO up bo'lsa 200 ready", async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(200);
    const body = res.body as ApiEnvelope;
    expect(body.data.status).toBe('ready');
    expect(body.data.checks).toEqual({
      database: 'up',
      redis: 'up',
      storage: 'up',
    });
  });

  it('/ready (GET) -> MinIO down bo`lsa 503 degraded', async () => {
    storageMock.ping.mockResolvedValue(false);
    const res = await request(app.getHttpServer()).get('/ready').expect(503);
    const body = res.body as ApiEnvelope;
    expect(body.data.status).toBe('degraded');
    expect(body.data.checks?.storage).toBe('down');
  });

  it('/ready (GET) -> DB down bo`lsa 503', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('db down'));
    const res = await request(app.getHttpServer()).get('/ready').expect(503);
    expect((res.body as ApiEnvelope).data.checks?.database).toBe('down');
  });
});
