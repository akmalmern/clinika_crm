import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import {
  ClinicStatus,
  SubscriptionStatus,
} from '../../../common/constants/subscription.constant';
import { addCycle } from '../../subscriptions/subscriptions.service';
import {
  InvoiceStatus,
  TransactionStatus,
} from '../constants/billing.constant';

export interface ConfirmPaymentParams {
  clinicId: string;
  invoiceId: string;
  /** To'lov summasi (so'm, Decimal). Provayderlar uchun = invoice qoldig'i. */
  amount: Prisma.Decimal;
  provider: string;
  method?: string;
  /** Idempotency uchun tashqi tranzaksiya ID (Payme id / Click trans_id). */
  providerTxId?: string;
  reference?: string;
  /** MANUAL: tasdiqlagan super admin id. */
  confirmedBy?: string;
  raw?: Prisma.InputJsonValue;
  /** To'lov vaqti (MANUAL: admin kiritgan sana). Berilmasa — hozir. */
  performedAt?: Date;
  /** Provayderga xos raqamli holat (Payme PERFORMED=2). Saqlanadi. */
  providerState?: number;
  /**
   * Provayder oqimida avval CreateTransaction/Prepare bilan yaratilgan PENDING
   * tranzaksiya id. Berilsa — yangisi yaratilmaydi, shu yozuv PAID qilinadi.
   */
  existingTransactionId?: string;
}

export interface ConfirmPaymentResult {
  transactionId: string;
  invoiceStatus: string;
  fullyPaid: boolean;
  paidAmount: string;
  debtAmount: string;
  /** Tranzaksiya allaqachon qo'llangan bo'lsa (idempotent qayta chaqiruv). */
  alreadyApplied: boolean;
}

/**
 * To'lovni invoice'ga qo'llovchi MARKAZIY servis (Phase 3 yuragi).
 * Barcha provayderlar (Payme/Click/Manual) shu yerdan o'tadi — natija bir xil:
 *   1) Tranzaksiya PAID bo'ladi (idempotent — ikki marta qo'llanmaydi).
 *   2) invoice.paid_amount oshadi; to'liq to'langanda PAID, qisman PARTIAL.
 *   3) To'liq to'langanda: obuna uzayadi (next_billing_date), SUSPENDED -> ACTIVE.
 *
 * Hammasi BITTA DB tranzaksiyasida (atomik). Bu yerda audit YO'Q — chaqiruvchi
 * (provayder/manual servis) audit yozadi (MANUAL uchun audit majburiy).
 */
@Injectable()
export class PaymentApplicationService {
  constructor(@InjectPrisma() private readonly prisma: ExtendedPrismaClient) {}

  async confirmPayment(
    params: ConfirmPaymentParams,
  ): Promise<ConfirmPaymentResult> {
    const performedAt = params.performedAt ?? new Date();
    return this.prisma.$transaction(async (tx) => {
      // --- 1. Tranzaksiya yozuvi (PENDING -> PAID yoki yangi PAID) ---
      let transaction: { id: string; status: string };

      if (params.existingTransactionId) {
        const existing = await tx.transaction.findFirst({
          where: { id: params.existingTransactionId },
        });
        if (!existing) {
          throw new NotFoundException('Tranzaksiya topilmadi');
        }
        // IDEMPOTENT: allaqachon to'langan bo'lsa — qayta qo'llamaymiz.
        if (existing.status === TransactionStatus.PAID) {
          const invoice = await tx.invoice.findFirst({
            where: { id: params.invoiceId },
          });
          return {
            transactionId: existing.id,
            invoiceStatus: invoice?.status ?? InvoiceStatus.PAID,
            fullyPaid: invoice?.status === InvoiceStatus.PAID,
            paidAmount: (
              invoice?.paidAmount ?? new Prisma.Decimal(0)
            ).toString(),
            debtAmount: (
              invoice?.debtAmount ?? new Prisma.Decimal(0)
            ).toString(),
            alreadyApplied: true,
          };
        }
        const updated = await tx.transaction.update({
          where: { id: existing.id },
          data: {
            status: TransactionStatus.PAID,
            performedAt,
            state: params.providerState ?? existing.state,
            // params.raw undefined bo'lsa Prisma mavjud qiymatni o'zgartirmaydi.
            raw: params.raw,
          },
        });
        transaction = { id: updated.id, status: updated.status };
      } else {
        const created = await tx.transaction.create({
          data: {
            clinicId: params.clinicId,
            invoiceId: params.invoiceId,
            provider: params.provider,
            method: params.method,
            providerTxId: params.providerTxId,
            reference: params.reference,
            amount: params.amount,
            status: TransactionStatus.PAID,
            state: params.providerState,
            performedAt,
            confirmedBy: params.confirmedBy,
            raw: params.raw ?? {},
          },
        });
        transaction = { id: created.id, status: created.status };
      }

      // --- 2. Invoice'ni kreditlash ---
      const invoice = await tx.invoice.findFirst({
        where: { id: params.invoiceId },
      });
      if (!invoice) throw new NotFoundException('Hisob-faktura topilmadi');
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException(
          'Bekor qilingan hisob-fakturaga to`lov yo`q',
        );
      }

      const newPaid = invoice.paidAmount.plus(params.amount);
      if (newPaid.greaterThan(invoice.totalAmount)) {
        throw new BadRequestException(
          'To`lov summasi hisob-faktura qoldig`idan oshib ketdi',
        );
      }
      const newDebt = invoice.totalAmount.minus(newPaid);
      const fullyPaid = newDebt.lessThanOrEqualTo(0);
      const status = fullyPaid
        ? InvoiceStatus.PAID
        : newPaid.greaterThan(0)
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.UNPAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          debtAmount: fullyPaid ? new Prisma.Decimal(0) : newDebt,
          status,
          paidAt: fullyPaid ? performedAt : invoice.paidAt,
        },
      });

      // --- 3. To'liq to'langanda: obunani uzaytirish + klinikani faollashtirish ---
      if (fullyPaid && invoice.subscriptionId) {
        const sub = await tx.subscription.findFirst({
          where: { id: invoice.subscriptionId },
          include: { plan: true },
        });
        if (sub) {
          // Yangi davr: invoice davri tugashidan (drift bo'lmasin), bo'lmasa
          // joriy next_billing'dan bir sikl.
          const cycle = sub.plan?.billingCycle ?? 'MONTHLY';
          const newNext =
            invoice.periodEnd ??
            addCycle(sub.nextBillingDate ?? new Date(), cycle);

          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              nextBillingDate: newNext,
              endDate: newNext,
              graceUntil: null,
            },
          });

          // SUSPENDED/TRIAL/PAST_DUE klinikani ACTIVE'ga qaytaramiz.
          await tx.clinic.updateMany({
            where: {
              id: invoice.clinicId,
              deletedAt: null,
              status: {
                in: [
                  ClinicStatus.SUSPENDED,
                  ClinicStatus.TRIAL,
                  // PAST_DUE klinikada bo'lmasligi mumkin, lekin himoya uchun:
                  SubscriptionStatus.PAST_DUE,
                ],
              },
            },
            data: { status: ClinicStatus.ACTIVE },
          });
        }
      }

      return {
        transactionId: transaction.id,
        invoiceStatus: updatedInvoice.status,
        fullyPaid,
        paidAmount: updatedInvoice.paidAmount.toString(),
        debtAmount: updatedInvoice.debtAmount.toString(),
        alreadyApplied: false,
      };
    });
  }
}
