import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PaymeController } from './../src/modules/billing/controllers/payme.controller';
import { PaymeService } from './../src/modules/billing/services/payme.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';

/**
 * Payme webhook e2e (infratuzilmasiz — PaymeService mock). Maqsad:
 *  1) Auth muvaffaqiyatsiz -> JSON-RPC error -32504 (raw, konvertga O'RALMAGAN),
 *  2) Muvaffaqiyatli -> {jsonrpc, id, result} raw (ResponseInterceptor o'ramaydi —
 *     @Res() tufayli). Bu Payme protokol kontrakti uchun muhim.
 */
describe('Payme webhook (e2e)', () => {
  let app: INestApplication<App>;

  const paymeMock = {
    checkAuth: jest.fn(),
    dispatch: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymeController],
      providers: [{ provide: PaymeService, useValue: paymeMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Global konvert qo'shamiz — webhook undan QUTULISHI kerak (@Res raw).
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('auth xato -> JSON-RPC -32504 (raw, success konverti yo`q)', async () => {
    paymeMock.checkAuth.mockReturnValue(false);

    const res = await request(app.getHttpServer())
      .post('/billing/payme')
      .send({ method: 'CheckPerformTransaction', params: {}, id: 42 })
      .expect(200);

    const body = res.body as {
      jsonrpc?: string;
      id?: number;
      error?: { code: number };
      success?: boolean;
    };
    expect(body.success).toBeUndefined(); // konvertga o'ralmagan
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(42);
    expect(body.error?.code).toBe(-32504);
    expect(paymeMock.dispatch).not.toHaveBeenCalled();
  });

  it('auth ok -> dispatch natijasi raw qaytadi', async () => {
    paymeMock.checkAuth.mockReturnValue(true);
    paymeMock.dispatch.mockResolvedValue({ result: { allow: true } });

    const res = await request(app.getHttpServer())
      .post('/billing/payme')
      .set('Authorization', 'Basic xxx')
      .send({ method: 'CheckPerformTransaction', params: { amount: 1 }, id: 7 })
      .expect(200);

    const body = res.body as {
      jsonrpc?: string;
      id?: number;
      result?: { allow: boolean };
      success?: boolean;
    };
    expect(body.success).toBeUndefined();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(7);
    expect(body.result?.allow).toBe(true);
  });
});
