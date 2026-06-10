import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { NextFunction, Request, Response } from 'express';
import { ClinicReportsController } from './../src/modules/reports/clinic-reports.controller';
import { ClinicReportsService } from './../src/modules/reports/clinic-reports.service';
import { PlatformReportsController } from './../src/modules/reports/platform-reports.controller';
import { PlatformReportsService } from './../src/modules/reports/platform-reports.service';
import { ReportExportService } from './../src/modules/reports/report-export.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * Reports e2e (infratuzilmasiz — servislar mock). HTTP qatlami:
 *  - TENANT IZOLYATSIYA: klinika hisoboti TOKEN'dagi clinicId bilan chaqiriladi
 *    (so'rovdan EMAS); begona ?clinicId rad etiladi (forbidNonWhitelisted).
 *  - Eksport CSV content-type to'g'ri.
 *  - Platforma route ishlaydi.
 */
describe('Reports (e2e)', () => {
  let app: INestApplication<App>;

  const clinicMock = {
    revenue: jest.fn().mockResolvedValue({
      range: { from: 'a', to: 'b', groupBy: 'day' },
      byPeriod: [],
      byMethod: [],
      totals: { count: 0, total: '0' },
      debt: { totalDebt: '0' },
    }),
    patientFlow: jest.fn().mockResolvedValue({
      range: { from: 'a', to: 'b', groupBy: 'day' },
      newPatients: { total: 0, byPeriod: [] },
      appointments: { total: 0, byStatus: [] },
      noShow: { count: 0, rate: 0 },
    }),
    doctorLoad: jest.fn().mockResolvedValue({ range: {}, rows: [] }),
    topServices: jest.fn().mockResolvedValue({ range: {}, rows: [] }),
  };

  const platformMock = {
    overview: jest.fn().mockResolvedValue({
      clinics: { total: 2, byStatus: [] },
      subscriptions: { active: 1, byStatus: [] },
    }),
    revenue: jest.fn().mockResolvedValue({ range: {}, byPeriod: [], byProvider: [], totals: { count: 0, total: '0' } }),
    subscriptions: jest.fn().mockResolvedValue({ active: 1, byStatus: [], expiringSoon: {}, debtors: {} }),
    topClinics: jest.fn().mockResolvedValue({ range: {}, rows: [] }),
  };

  const exportMock = {
    build: jest.fn().mockReturnValue({
      buffer: Buffer.from('Davr,Soni,Summa'),
      contentType: 'text/csv; charset=utf-8',
      fileName: 'daromad.csv',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ClinicReportsController, PlatformReportsController],
      providers: [
        { provide: ClinicReportsService, useValue: clinicMock },
        { provide: PlatformReportsService, useValue: platformMock },
        { provide: ReportExportService, useValue: exportMock },
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
          userId: 'admin1',
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

  it('GET /clinic/reports/revenue -> 200 + TOKEN clinicId (so`rovdan emas)', async () => {
    const res = await request(app.getHttpServer())
      .get('/clinic/reports/revenue?groupBy=day')
      .expect(200);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(true);
    // Tenant: servis TOKEN'dagi 'cl1' bilan chaqirildi
    expect(clinicMock.revenue).toHaveBeenCalledWith(
      'cl1',
      expect.objectContaining({ groupBy: 'day' }),
    );
  });

  it('GET /clinic/reports/revenue?clinicId=other -> 400 (begona param rad etiladi)', async () => {
    await request(app.getHttpServer())
      .get('/clinic/reports/revenue?clinicId=cl2')
      .expect(400);
    expect(clinicMock.revenue).not.toHaveBeenCalled();
  });

  it('GET /clinic/reports/revenue/export?format=csv -> CSV content-type', async () => {
    const res = await request(app.getHttpServer())
      .get('/clinic/reports/revenue/export?format=csv')
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('daromad.csv');
    expect(exportMock.build).toHaveBeenCalledWith(
      'csv',
      expect.objectContaining({ title: expect.any(String) }),
      'daromad',
    );
  });

  it('GET /clinic/reports/patient-flow -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/clinic/reports/patient-flow')
      .expect(200);
    expect((res.body as { success: boolean }).success).toBe(true);
    expect(clinicMock.patientFlow).toHaveBeenCalledWith('cl1', expect.any(Object));
  });

  it('GET /clinic/reports/top-services?limit=abc -> 400 (validatsiya)', async () => {
    await request(app.getHttpServer())
      .get('/clinic/reports/top-services?limit=abc')
      .expect(400);
  });

  it('GET /super-admin/reports/overview -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/super-admin/reports/overview')
      .expect(200);
    const body = res.body as { success: boolean; data: { clinics: { total: number } } };
    expect(body.success).toBe(true);
    expect(body.data.clinics.total).toBe(2);
    expect(platformMock.overview).toHaveBeenCalledTimes(1);
  });

  it('GET /super-admin/reports/subscriptions?days=7 -> 200', async () => {
    await request(app.getHttpServer())
      .get('/super-admin/reports/subscriptions?days=7')
      .expect(200);
    expect(platformMock.subscriptions).toHaveBeenCalledWith(7);
  });
});
