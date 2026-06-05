import { Module } from '@nestjs/common';
import { InvoiceService } from './services/invoice.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { PaymentApplicationService } from './services/payment-application.service';
import { ManualPaymentService } from './services/manual-payment.service';
import { PaymentStatsService } from './services/payment-stats.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { PaymeService } from './services/payme.service';
import { ClickService } from './services/click.service';
import { BillingAdminController } from './controllers/billing-admin.controller';
import { ClinicInvoicesController } from './controllers/clinic-invoices.controller';
import { PaymeController } from './controllers/payme.controller';
import { ClickController } from './controllers/click.controller';

/**
 * Billing moduli (Phase 3): hisob-fakturalar, to'lovlar (Payme/Click/Manual),
 * obuna sikli mantig'i, PDF, statistika. BullMQ'ga BOG'LIQ EMAS — cron alohida
 * `BillingSchedulerModule`'da (test muhitida Redis'siz ham yuklanadi).
 *
 * Prisma/Audit/Config global modullardan keladi (DI orqali).
 */
@Module({
  controllers: [
    BillingAdminController,
    ClinicInvoicesController,
    PaymeController,
    ClickController,
  ],
  providers: [
    InvoiceService,
    InvoicePdfService,
    PaymentApplicationService,
    ManualPaymentService,
    PaymentStatsService,
    SubscriptionBillingService,
    PaymeService,
    ClickService,
  ],
  exports: [SubscriptionBillingService],
})
export class BillingModule {}
