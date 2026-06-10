import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * Prometheus metrikalari (spec 10). Global interceptor barcha HTTP so'rovlarni
 * o'lchaydi; `/metrics` endpoint scrape uchun. `/metrics` o'zi response'ni
 * to'g'ridan-to'g'ri yuborgani uchun interceptor uni o'lchamaydi (xavfsiz).
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
