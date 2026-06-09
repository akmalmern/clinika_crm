import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { NextFunction, Request, Response } from 'express';
import { EmrController } from './../src/modules/emr/emr.controller';
import { EmrService } from './../src/modules/emr/emr.service';
import { PrescriptionPdfService } from './../src/modules/emr/prescription-pdf.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * EMR e2e (infratuzilmasiz — EmrService mock). HTTP qatlami: ko'rik yaratish,
 * bemor tarixi (timeline), validatsiya (patientId UUID).
 */
describe('EMR (e2e)', () => {
  let app: INestApplication<App>;
  const PID = '019e0000-0000-7000-8000-000000000001';

  const emrMock = {
    createRecord: jest.fn().mockResolvedValue({ id: 'r1', diagnosis: 'J06.9' }),
    timeline: jest
      .fn()
      .mockResolvedValue([
        { record: { id: 'r1' }, prescriptions: [], files: [] },
      ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EmrController],
      providers: [
        { provide: EmrService, useValue: emrMock },
        { provide: PrescriptionPdfService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = {
          userId: 'doc1',
          actorType: 'USER',
          clinicId: 'cl1',
          role: 'DOCTOR',
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

  it('POST /clinic/medical-records -> 201 + data', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinic/medical-records')
      .send({ patientId: PID, diagnosis: 'J06.9', icdCode: 'J06.9' })
      .expect(201);
    const body = res.body as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('r1');
    expect(emrMock.createRecord).toHaveBeenCalledTimes(1);
  });

  it('GET /clinic/patients/:id/history -> 200 timeline', async () => {
    const res = await request(app.getHttpServer())
      .get(`/clinic/patients/${PID}/history`)
      .expect(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(emrMock.timeline).toHaveBeenCalledTimes(1);
  });

  it('POST /clinic/medical-records patientId yo`q -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinic/medical-records')
      .send({ diagnosis: 'X' })
      .expect(400);
    expect((res.body as { success: boolean }).success).toBe(false);
    expect(emrMock.createRecord).not.toHaveBeenCalled();
  });
});
