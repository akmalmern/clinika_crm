/**
 * To'liq AppModule bootstrap e2e — infratuzilmasiz (Prisma/Redis mock).
 * Maqsad: butun DI grafigi (global guard'lar, throttler, passport JWT strategiyasi,
 * interceptor'lar, exception filter, config validatsiyasi) xatosiz ulanishini va
 * himoyalangan/ochiq route'lar to'g'ri ishlashini tasdiqlash.
 */

// Muhit o'zgaruvchilari jest setupFiles (test/setup-env.ts) da — har qanday
// modul yuklanishidan oldin — o'rnatiladi, shu sababli bu yerda statik import bemalol.
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/core/prisma/prisma.service';
import { RedisService } from './../src/core/redis/redis.service';
import { EXTENDED_PRISMA } from './../src/core/prisma/prisma.module';
import { tenantContextMiddleware } from './../src/core/tenant/tenant.middleware';

describe('AppModule bootstrap (e2e, mocked infra)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  const redisMock = {
    raw: { ping: jest.fn().mockResolvedValue('PONG') },
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(EXTENDED_PRISMA)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(tenantContextMiddleware);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ochiq route /api/v1/health -> standart konvert', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    const body = res.body as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('himoyalangan /api/v1/auth/me tokensiz -> 401 (global JwtAuthGuard)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
    const body = res.body as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('request-id header javobda mavjud (tenant middleware)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
