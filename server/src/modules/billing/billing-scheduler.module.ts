import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BillingModule } from './billing.module';
import { BILLING_QUEUE } from './cron/billing-queue.constant';
import { BillingProcessor } from './cron/billing.processor';
import { BillingScheduler } from './cron/billing.scheduler';

/**
 * Billing cron (BullMQ) — alohida modul. AppModule uni FAQAT test bo'lmagan
 * muhitda yuklaydi, shunda e2e testlar Redis/BullMQ ulanishini talab qilmaydi.
 * BullMQ ulanishi global `QueueModule` (core/queue) orqali keladi.
 */
@Module({
  imports: [BillingModule, BullModule.registerQueue({ name: BILLING_QUEUE })],
  providers: [BillingProcessor, BillingScheduler],
})
export class BillingSchedulerModule {}
