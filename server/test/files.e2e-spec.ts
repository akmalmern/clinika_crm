import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { NextFunction, Request, Response } from 'express';
import { FilesController } from './../src/modules/files/files.controller';
import { FilesService } from './../src/modules/files/files.service';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

/**
 * Files e2e (infratuzilmasiz — FilesService mock). HTTP qatlami:
 *  - signed URL standart konvertда qaytadi,
 *  - faylsiz upload -> 400,
 *  - fayl bilan upload -> servis chaqiriladi.
 */
describe('Files (e2e)', () => {
  let app: INestApplication<App>;

  const filesServiceMock = {
    upload: jest
      .fn()
      .mockResolvedValue({ id: 'f1', size: '3', category: 'PASSPORT' }),
    list: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    getSignedUrl: jest
      .fn()
      .mockResolvedValue({ url: 'https://signed', expiresIn: 300 }),
    remove: jest.fn().mockResolvedValue({ id: 'f1' }),
  };

  const OWNER_ID = '019e0000-0000-7000-8000-000000000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: filesServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Klinika foydalanuvchisini simulyatsiya qilamiz (global guard'larsiz)
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

  it('GET /files/:id/url -> standart konvert + signed URL', async () => {
    const res = await request(app.getHttpServer())
      .get(`/files/${OWNER_ID}/url`)
      .expect(200);
    const body = res.body as {
      success: boolean;
      data: { url: string; expiresIn: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.url).toBe('https://signed');
    expect(filesServiceMock.getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('POST /files/upload faylsiz -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/files/upload')
      .field('ownerType', 'USER')
      .field('ownerId', OWNER_ID)
      .field('category', 'PASSPORT')
      .expect(400);
    const body = res.body as { success: boolean };
    expect(body.success).toBe(false);
    expect(filesServiceMock.upload).not.toHaveBeenCalled();
  });

  it('POST /files/upload fayl bilan -> servis chaqiriladi', async () => {
    const res = await request(app.getHttpServer())
      .post('/files/upload')
      .field('ownerType', 'USER')
      .field('ownerId', OWNER_ID)
      .field('category', 'PASSPORT')
      .attach('file', Buffer.from('abc'), {
        filename: 'a.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const body = res.body as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('f1');
    expect(filesServiceMock.upload).toHaveBeenCalledTimes(1);
  });
});
