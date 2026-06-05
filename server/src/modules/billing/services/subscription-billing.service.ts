import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { BillingConfig } from '../../../config/configuration';
import { ActorType } from '../../../common/constants/roles.constant';
import {
  ClinicStatus,
  SubscriptionStatus,
} from '../../../common/constants/subscription.constant';
import { AuditService } from '../../audit/audit.service';
import { addCycle, addDays } from '../../subscriptions/subscriptions.service';
import { InvoiceStatus } from '../constants/billing.constant';
import { buildInvoiceNumber } from '../billing.util';

export interface DailyBillingResult {
  invoicesCreated: number;
  clinicsSuspended: number;
}

/** Bir obuna sikli uchun hisoblangan davr (sof — DB'siz, testlanadigan). */
export interface BillingPeriod {
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  graceUntil: Date;
}

/**
 * Obuna sikli uchun davr va muhlatlarni hisoblaydi (sof funksiya).
 * periodStart = sikl boshlangan (next_billing) sana; due/grace = +graceDays.
 */
export function computeBillingPeriod(
  nextBillingDate: Date,
  billingCycle: string,
  graceDays: number,
): BillingPeriod {
  return {
    periodStart: nextBillingDate,
    periodEnd: addCycle(nextBillingDate, billingCycle),
    dueDate: addDays(nextBillingDate, graceDays),
    graceUntil: addDays(nextBillingDate, graceDays),
  };
}

const UNSETTLED_STATUSES: string[] = [
  InvoiceStatus.UNPAID,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.OVERDUE,
];

/**
 * Abonent to'lovi sikli (spec 5.3). Har kuni cron (BullMQ) chaqiradi:
 *   1) next_billing_date yetgan obunalarga invoice yaratadi (idempotent — dublь yo'q),
 *      obunani PAST_DUE + grace muhlat bilan belgilaydi.
 *   2) grace muhlati o'tgan, hali to'lanmagan klinikalarni SUSPENDED qiladi.
 *
 * Idempotentlik: (subscription_id, period_start) partial unique index +
 * tranzaksiya ichidagi mavjudlik tekshiruvi -> bir davr uchun bitta invoice.
 *
 * Bu servis BullMQ'ga BOG'LIQ EMAS -> to'g'ridan-to'g'ri unit test qilinadi.
 */
@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger('Billing');

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async runDailyBilling(now: Date = new Date()): Promise<DailyBillingResult> {
    const graceDays =
      this.config.getOrThrow<BillingConfig>('billing').graceDays;
    let invoicesCreated = 0;
    let clinicsSuspended = 0;

    // --- 1. Muddati kelgan obunalarga invoice ---
    const dueSubs = await this.prisma.subscription.findMany({
      where: {
        deletedAt: null,
        nextBillingDate: { lte: now },
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
      include: { plan: true },
    });

    for (const sub of dueSubs) {
      if (!sub.nextBillingDate || !sub.plan) continue;
      const created = await this.ensureInvoiceForPeriod(sub, graceDays);
      if (created) invoicesCreated++;
    }

    // --- 2. Grace o'tgan, to'lanmagan klinikalarni SUSPENDED qilish ---
    const overdueSubs = await this.prisma.subscription.findMany({
      where: {
        deletedAt: null,
        status: SubscriptionStatus.PAST_DUE,
        graceUntil: { lt: now },
      },
    });

    for (const sub of overdueSubs) {
      const suspended = await this.suspendIfUnpaid(sub.id, sub.clinicId);
      if (suspended) clinicsSuspended++;
    }

    this.logger.log(
      `Kunlik billing: ${invoicesCreated} invoice, ${clinicsSuspended} suspend (now=${now.toISOString()})`,
    );
    return { invoicesCreated, clinicsSuspended };
  }

  /** Bitta obuna uchun joriy davr invoice'ini yaratadi (yaratilsa true). */
  private async ensureInvoiceForPeriod(
    sub: Prisma.SubscriptionGetPayload<{ include: { plan: true } }>,
    graceDays: number,
  ): Promise<boolean> {
    const period = computeBillingPeriod(
      sub.nextBillingDate as Date,
      sub.plan.billingCycle,
      graceDays,
    );

    let created = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.invoice.findFirst({
          where: {
            subscriptionId: sub.id,
            periodStart: period.periodStart,
            deletedAt: null,
          },
        });
        if (existing) return; // idempotent: shu davr invoice'i bor

        await tx.invoice.create({
          data: {
            clinicId: sub.clinicId,
            subscriptionId: sub.id,
            invoiceNumber: buildInvoiceNumber(period.periodStart, uuidv7()),
            totalAmount: sub.plan.price,
            paidAmount: new Prisma.Decimal(0),
            debtAmount: sub.plan.price,
            currency: sub.plan.currency,
            status: InvoiceStatus.UNPAID,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            dueDate: period.dueDate,
          },
        });

        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.PAST_DUE,
            graceUntil: period.graceUntil,
          },
        });

        created = true;
      });
    } catch (err) {
      // Bir vaqtning o'zida (konkurent) dublikat -> partial unique P2002: e'tiborsiz.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }

    if (created) {
      await this.auditService.log({
        action: 'INVOICE_GENERATED',
        entity: 'Invoice',
        actorType: ActorType.SYSTEM,
        clinicId: sub.clinicId,
        metadata: {
          subscriptionId: sub.id,
          periodStart: period.periodStart.toISOString(),
          amount: sub.plan.price.toString(),
        },
      });
    }
    return created;
  }

  /** Klinikada to'lanmagan invoice bo'lsa SUSPENDED qiladi (true qaytaradi). */
  private async suspendIfUnpaid(
    subscriptionId: string,
    clinicId: string,
  ): Promise<boolean> {
    const unpaid = await this.prisma.invoice.findFirst({
      where: {
        subscriptionId,
        status: { in: UNSETTLED_STATUSES },
        deletedAt: null,
      },
    });
    if (!unpaid) return false; // to'langan -> suspend kerak emas

    await this.prisma.$transaction(async (tx) => {
      await tx.clinic.updateMany({
        where: {
          id: clinicId,
          deletedAt: null,
          status: { notIn: [ClinicStatus.CANCELLED] },
        },
        data: { status: ClinicStatus.SUSPENDED },
      });
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.SUSPENDED },
      });
      await tx.invoice.updateMany({
        where: {
          subscriptionId,
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
          deletedAt: null,
        },
        data: { status: InvoiceStatus.OVERDUE },
      });
    });

    await this.auditService.log({
      action: 'CLINIC_SUSPENDED_NONPAYMENT',
      entity: 'Clinic',
      entityId: clinicId,
      actorType: ActorType.SYSTEM,
      clinicId,
      metadata: { subscriptionId, reason: 'GRACE_PERIOD_EXPIRED' },
    });
    return true;
  }
}
