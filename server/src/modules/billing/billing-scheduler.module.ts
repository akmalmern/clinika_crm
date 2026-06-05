import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '../../config/configuration';
import { BillingModule } from './billing.module';
import { BILLING_QUEUE } from './cron/billing-queue.constant';
import { BillingProcessor } from './cron/billing.processor';
import { BillingScheduler } from './cron/billing.scheduler';

/**
 * Billing cron (BullMQ) — alohida modul. AppModule uni FAQAT test bo'lmagan
 * muhitda yuklaydi, shunda e2e testlar Redis/BullMQ ulanishini talab qilmaydi.
 * Ulanish Redis konfiguratsiyasidan (spec 1.6.C — stateless backend) olinadi.
 */
@Module({
  imports: [
    BillingModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: BILLING_QUEUE }),
  ],
  providers: [BillingProcessor, BillingScheduler],
})
export class BillingSchedulerModule {}
