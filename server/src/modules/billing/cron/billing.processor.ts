import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  DailyBillingResult,
  SubscriptionBillingService,
} from '../services/subscription-billing.service';
import { BILLING_QUEUE } from './billing-queue.constant';

/**
 * BullMQ worker — billing navbatidagi joblarni bajaradi. Biznes mantiq
 * SubscriptionBillingService'da (BullMQ'siz testlanadi); bu yerda faqat ulanish.
 */
@Processor(BILLING_QUEUE)
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger('BillingProcessor');

  constructor(private readonly billing: SubscriptionBillingService) {
    super();
  }

  async process(job: Job): Promise<DailyBillingResult> {
    this.logger.log(`Billing job boshlandi: ${job.name} (#${job.id})`);
    const result = await this.billing.runDailyBilling(new Date());
    this.logger.log(
      `Billing job tugadi: ${result.invoicesCreated} invoice, ${result.clinicsSuspended} suspend`,
    );
    return result;
  }
}
