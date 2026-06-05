import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BILLING_DAILY_CRON,
  BILLING_DAILY_JOB_ID,
  BILLING_QUEUE,
  BillingJob,
} from './billing-queue.constant';

/**
 * Kunlik billing repeatable job'ini ro'yxatga oladi (spec 5.3 — cron).
 * Barqaror jobId tufayli qayta ishga tushishda dublikat scheduler yaratilmaydi
 * (idempotent). Vaqt UTC (spec 1.5).
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger('BillingScheduler');

  constructor(@InjectQueue(BILLING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      BillingJob.DAILY,
      {},
      {
        repeat: { pattern: BILLING_DAILY_CRON, tz: 'UTC' },
        jobId: BILLING_DAILY_JOB_ID,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    this.logger.log(
      `Kunlik billing cron ro'yxatga olindi: "${BILLING_DAILY_CRON}" (UTC)`,
    );
  }
}
