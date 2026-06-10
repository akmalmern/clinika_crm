import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig, ObservabilityConfig } from './config/configuration';
import { tenantContextMiddleware } from './core/tenant/tenant.middleware';
import { initSentry } from './core/observability/sentry';

async function bootstrap(): Promise<void> {
  // bufferLogs: pino logger tayyor bo'lguncha boshlang'ich loglar buferlanadi.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Strukturalangan loglar (pino) — barcha Nest loglari shu orqali o'tadi.
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const appCfg = config.getOrThrow<AppConfig>('app');
  const obs = config.getOrThrow<ObservabilityConfig>('observability');

  // Sentry (faqat DSN bo'lsa) — xatolarni kuzatish (spec 10).
  initSentry({
    dsn: obs.sentryDsn,
    environment: obs.sentryEnv,
    tracesSampleRate: obs.sentryTracesSampleRate,
    release: process.env.APP_RELEASE,
  });

  // Tenant kontekstini (AsyncLocalStorage) ENG BOSHIDA o'rnatamiz —
  // request-id, IP/UA va keyingi tenant ma'lumotlari shu store'da yashaydi.
  app.use(tenantContextMiddleware);

  // Global API prefiks (spec 9-bo'lim). health/ready/metrics ham shu prefiks ostida.
  app.setGlobalPrefix('api/v1');

  // Xavfsizlik: Helmet + CORS.
  app.use(helmet());
  app.enableCors({
    origin: appCfg.corsOrigins.length > 0 ? appCfg.corsOrigins : true,
    credentials: true,
  });

  // Global validatsiya (DTO'lar). Noma'lum maydonlar tashlab yuboriladi.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Graceful shutdown (Prisma/Redis/BullMQ ulanishlarini toza yopadi).
  app.enableShutdownHooks();

  // Swagger (spec 9 / 16) — barcha endpoint'lar hujjatlanadi.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Klinika CRM API')
    .setDescription(
      'Multi-Tenant SaaS Klinika CRM — REST API.\n\n' +
        'Autentifikatsiya: `Authorization: Bearer <accessToken>`.\n' +
        "Tenant izolyatsiyasi token ichidagi `clinicId` orqali avtomatik qo'llanadi.\n" +
        'Standart javob: `{ success, data, message, meta }`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addTag('auth', 'Autentifikatsiya (login/refresh/logout/me)')
    .addTag('clinics (super-admin)', 'Klinikalarni boshqarish')
    .addTag('patients', 'Bemorlar')
    .addTag('appointments', 'Qabullar va kalendar')
    .addTag('cashier (patient billing)', 'Kassa — bemor to`lovlari')
    .addTag('emr', 'Tibbiy yozuvlar (maxfiy)')
    .addTag('files', 'Universal fayl/hujjat moduli')
    .addTag('billing (super-admin)', 'Abonent to`lovlari (Payme/Click/MANUAL)')
    .addTag('reports (clinic)', 'Klinika hisobotlari')
    .addTag('reports (platform / super-admin)', 'Platforma statistikasi')
    .addTag('health', 'Health-check (liveness/readiness)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(appCfg.port);

  const logger = app.get(PinoLogger);
  logger.log(`Backend ishga tushdi: http://localhost:${appCfg.port}/api/v1`);
  logger.log(`Swagger: http://localhost:${appCfg.port}/api/docs`);
  logger.log(
    `Observability: log=${obs.logLevel} sentry=${obs.sentryDsn ? 'on' : 'off'} metrics=${obs.metricsEnabled ? 'on' : 'off'}`,
  );
}

void bootstrap();
