import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { tenantContextMiddleware } from './core/tenant/tenant.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const appCfg = config.getOrThrow<AppConfig>('app');

  // Tenant kontekstini (AsyncLocalStorage) ENG BOSHIDA o'rnatamiz —
  // request-id, IP/UA va keyingi tenant ma'lumotlari shu store'da yashaydi.
  app.use(tenantContextMiddleware);

  // Global API prefiks (spec 9-bo'lim).
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

  // Graceful shutdown (Prisma/Redis ulanishlarini toza yopadi).
  app.enableShutdownHooks();

  // Swagger (spec 9 / 16-bo'lim — yangi endpoint'lar hujjatlanadi).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Klinika CRM API')
    .setDescription('Multi-Tenant SaaS Klinika CRM — Phase 1')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appCfg.port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Backend ishga tushdi: http://localhost:${appCfg.port}/api/v1`);
  logger.log(`📚 Swagger: http://localhost:${appCfg.port}/api/docs`);
}

void bootstrap();
