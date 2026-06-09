import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { NextFunction, Request, Response } from 'express';
import { PatientsController } from './../src/modules/patients/patients.controller';
import { PatientsService } from './../src/modules/patients/patients.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * Patients e2e (infratuzilmasiz — PatientsService mock). HTTP qatlami:
 *  - create + list standart konvertда,
 *  - validatsiya (fullName majburiy) -> 400.
 */
describe('Patients (e2e)', () => {
  let app: INestApplication<App>;

  const patientsServiceMock = {
    create: jest.fn().mockResolvedValue({ id: 'p1', fullName: 'Aliyeva' }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [{ id: 'p1' }], meta: { total: 1 } }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [{ provide: PatientsService, useValue: patientsServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = {
          userId: 'u1',
          actorType: 'USER',
          clinicId: 'cl1',
          role: 'CLINIC_ADMIN',
        };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /clinic/patients -> 201 + data', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinic/patients')
      .send({ fullName: 'Aliyeva Nodira', gender: 'FEMALE' })
      .expect(201);
    const body = res.body as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('p1');
    expect(patientsServiceMock.create).toHaveBeenCalledTimes(1);
  });

  it('GET /clinic/patients -> 200 standart konvert', async () => {
    const res = await request(app.getHttpServer())
      .get('/clinic/patients?search=ali')
      .expect(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /clinic/patients fullName yo`q -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinic/patients')
      .send({ gender: 'FEMALE' })
      .expect(400);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(false);
    expect(patientsServiceMock.create).not.toHaveBeenCalled();
  });
});
