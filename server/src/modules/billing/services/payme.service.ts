import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { PaymeConfig } from '../../../config/configuration';
import { ActorType } from '../../../common/constants/roles.constant';
import { AuditService } from '../../audit/audit.service';
import {
  InvoiceStatus,
  PAYME_AUTH_LOGIN,
  PAYME_MESSAGES,
  PAYME_TRANSACTION_TIMEOUT_MS,
  PaymeError,
  PaymeState,
  PaymentProvider,
  TransactionStatus,
} from '../constants/billing.constant';
import { somToTiyin, tiyinEqualsSom, tiyinToSom } from '../billing.util';
import { PaymentApplicationService } from './payment-application.service';

interface PaymeErrorObject {
  code: number;
  message: { ru: string; uz: string; en: string } | string;
  data?: unknown;
}
export type PaymeResponse =
  | { result: Record<string, unknown> }
  | { error: PaymeErrorObject };

type TxRow = Prisma.TransactionGetPayload<object>;

/**
 * Payme Merchant API (JSON-RPC 2.0) — spec 5.4. Rasmiy protokol:
 * CheckPerformTransaction / CreateTransaction / PerformTransaction /
 * CancelTransaction / CheckTransaction / GetStatement.
 *
 * - Pul tiyinda (1 so'm = 100 tiyin) keladi; bazada Decimal so'mda saqlanadi.
 * - Vaqt epoch-millisekundda almashinadi.
 * - Idempotency: provider_tx_id (Payme `id`) unique -> ikki marta yozilmaydi.
 * - Holat mantig'i (state): 1 created, 2 performed, -1/-2 cancelled.
 * - Bu servis HECH QACHON throw qilmaydi (protokol xatosi -> {error}); kutilmagan
 *   istisno faqat controller'da umumiy xatoga aylanadi.
 */
@Injectable()
export class PaymeService {
  private readonly logger = new Logger('Payme');
  private readonly cfg: PaymeConfig;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
    private readonly payments: PaymentApplicationService,
    private readonly auditService: AuditService,
  ) {
    this.cfg = config.getOrThrow<PaymeConfig>('payme');
  }

  /** Basic auth tekshiruvi (login=Paycom, parol=merchant key yoki test key). */
  checkAuth(authHeader?: string): boolean {
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    } catch {
      return false;
    }
    const sep = decoded.indexOf(':');
    if (sep === -1) return false;
    const login = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);
    if (login !== PAYME_AUTH_LOGIN) return false;
    return (
      this.safeEqual(password, this.cfg.merchantKey) ||
      (!!this.cfg.testKey && this.safeEqual(password, this.cfg.testKey))
    );
  }

  private safeEqual(a: string, b: string): boolean {
    if (!a || !b) return false;
    // Uzunlik sirini ham yashirish uchun hash'larni taqqoslaymiz.
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
  }

  /** JSON-RPC metodini tegishli handler'ga yo'naltiradi. */
  async dispatch(
    method: string,
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerform(params);
      case 'CreateTransaction':
        return this.createTransaction(params);
      case 'PerformTransaction':
        return this.performTransaction(params);
      case 'CancelTransaction':
        return this.cancelTransaction(params);
      case 'CheckTransaction':
        return this.checkTransaction(params);
      case 'GetStatement':
        return this.getStatement(params);
      default:
        return this.err(PaymeError.METHOD_NOT_FOUND, 'CANT_PERFORM', method);
    }
  }

  // ---- Metodlar ----

  private async checkPerform(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const amount = this.asNumber(params.amount);
    const invoiceId = this.accountInvoiceId(params);
    if (!invoiceId) return this.accountError();

    const invoice = await this.findInvoice(invoiceId);
    if (!invoice) return this.accountError();
    const settled = this.settledError(invoice.status);
    if (settled) return settled;
    if (!tiyinEqualsSom(amount, invoice.debtAmount)) {
      return this.err(PaymeError.INVALID_AMOUNT, 'INVALID_AMOUNT');
    }
    return { result: { allow: true } };
  }

  private async createTransaction(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const paycomId = this.asString(params.id);
    const amount = this.asNumber(params.amount);
    const time = this.asNumber(params.time);
    const invoiceId = this.accountInvoiceId(params);
    if (!invoiceId) return this.accountError();

    // Mavjud tranzaksiya (idempotent qayta yuborish)?
    const existing = await this.findByPaycomId(paycomId);
    if (existing) {
      if (existing.state === PaymeState.CREATED) {
        return {
          result: {
            create_time: existing.createdAt.getTime(),
            transaction: existing.id,
            state: PaymeState.CREATED,
          },
        };
      }
      // Boshqa holatda qayta yaratib bo'lmaydi.
      return this.err(PaymeError.CANT_PERFORM, 'CANT_PERFORM');
    }

    const invoice = await this.findInvoice(invoiceId);
    if (!invoice) return this.accountError();
    const settled = this.settledError(invoice.status);
    if (settled) return settled;
    if (!tiyinEqualsSom(amount, invoice.debtAmount)) {
      return this.err(PaymeError.INVALID_AMOUNT, 'INVALID_AMOUNT');
    }

    // Tranzaksiya muddati (12 soat) o'tib ketganmi?
    if (
      Number.isFinite(time) &&
      Date.now() - time > PAYME_TRANSACTION_TIMEOUT_MS
    ) {
      return this.err(PaymeError.CANT_PERFORM, 'CANT_PERFORM');
    }

    // Bu invoice uchun boshqa faol (CREATED) tranzaksiya bo'lsa — band.
    const pending = await this.prisma.transaction.findFirst({
      where: {
        invoiceId: invoice.id,
        provider: PaymentProvider.PAYME,
        status: TransactionStatus.PENDING,
      },
    });
    if (pending) {
      return this.err(PaymeError.CANT_PERFORM, 'CANT_PERFORM');
    }

    try {
      const created = await this.prisma.transaction.create({
        data: {
          clinicId: invoice.clinicId,
          invoiceId: invoice.id,
          provider: PaymentProvider.PAYME,
          method: 'ONLINE',
          providerTxId: paycomId,
          reference: JSON.stringify(params.account ?? {}),
          amount: tiyinToSom(amount),
          status: TransactionStatus.PENDING,
          state: PaymeState.CREATED,
          raw: { create: this.json(params) },
        },
      });
      return {
        result: {
          create_time: created.createdAt.getTime(),
          transaction: created.id,
          state: PaymeState.CREATED,
        },
      };
    } catch (err) {
      // Konkurent dublikat (provider_tx_id unique) -> mavjudni qaytaramiz.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await this.findByPaycomId(paycomId);
        if (again && again.state === PaymeState.CREATED) {
          return {
            result: {
              create_time: again.createdAt.getTime(),
              transaction: again.id,
              state: PaymeState.CREATED,
            },
          };
        }
      }
      throw err;
    }
  }

  private async performTransaction(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const paycomId = this.asString(params.id);
    const tx = await this.findByPaycomId(paycomId);
    if (!tx)
      return this.err(
        PaymeError.TRANSACTION_NOT_FOUND,
        'TRANSACTION_NOT_FOUND',
      );

    // Idempotent: allaqachon yakunlangan.
    if (tx.state === PaymeState.PERFORMED) {
      return {
        result: {
          transaction: tx.id,
          perform_time: tx.performedAt?.getTime() ?? 0,
          state: PaymeState.PERFORMED,
        },
      };
    }
    if (tx.state !== PaymeState.CREATED) {
      return this.err(PaymeError.CANT_PERFORM, 'CANT_PERFORM');
    }

    // Muddati o'tgan bo'lsa — bekor qilamiz va xato qaytaramiz.
    if (Date.now() - tx.createdAt.getTime() > PAYME_TRANSACTION_TIMEOUT_MS) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.CANCELLED,
          state: PaymeState.CANCELLED,
          cancelReason: 4,
          cancelledAt: new Date(),
        },
      });
      return this.err(PaymeError.CANT_PERFORM, 'CANT_PERFORM');
    }

    // To'lovni qo'llaymiz (invoice PAID/PARTIAL + obuna uzayadi).
    await this.payments.confirmPayment({
      clinicId: tx.clinicId,
      invoiceId: tx.invoiceId,
      amount: tx.amount,
      provider: PaymentProvider.PAYME,
      providerTxId: paycomId,
      existingTransactionId: tx.id,
      providerState: PaymeState.PERFORMED,
      raw: { perform: this.json(params) },
    });

    const performed = await this.findByPaycomId(paycomId);
    await this.auditService.log({
      action: 'PAYME_PERFORM',
      entity: 'Transaction',
      entityId: tx.id,
      actorType: ActorType.SYSTEM,
      clinicId: tx.clinicId,
      metadata: { invoiceId: tx.invoiceId, amount: tx.amount.toString() },
    });

    return {
      result: {
        transaction: tx.id,
        perform_time: performed?.performedAt?.getTime() ?? Date.now(),
        state: PaymeState.PERFORMED,
      },
    };
  }

  private async cancelTransaction(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const paycomId = this.asString(params.id);
    const reason = this.asNumber(params.reason);
    const tx = await this.findByPaycomId(paycomId);
    if (!tx)
      return this.err(
        PaymeError.TRANSACTION_NOT_FOUND,
        'TRANSACTION_NOT_FOUND',
      );

    // Idempotent: allaqachon bekor qilingan.
    if (
      tx.state === PaymeState.CANCELLED ||
      tx.state === PaymeState.CANCELLED_AFTER_PERFORM
    ) {
      return {
        result: {
          transaction: tx.id,
          cancel_time: tx.cancelledAt?.getTime() ?? 0,
          state: tx.state,
        },
      };
    }

    // CREATED -> -1 (invoice kreditlanmagan, oddiy bekor).
    if (tx.state === PaymeState.CREATED) {
      const cancelledAt = new Date();
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.CANCELLED,
          state: PaymeState.CANCELLED,
          cancelReason: Number.isFinite(reason) ? reason : null,
          cancelledAt,
        },
      });
      return {
        result: {
          transaction: tx.id,
          cancel_time: cancelledAt.getTime(),
          state: PaymeState.CANCELLED,
        },
      };
    }

    // PERFORMED -> -2 (qaytarish): invoice kreditini teskari qaytaramiz.
    const cancelledAt = new Date();
    await this.reversePerformedTransaction(tx, reason, cancelledAt);
    return {
      result: {
        transaction: tx.id,
        cancel_time: cancelledAt.getTime(),
        state: PaymeState.CANCELLED_AFTER_PERFORM,
      },
    };
  }

  private async checkTransaction(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const paycomId = this.asString(params.id);
    const tx = await this.findByPaycomId(paycomId);
    if (!tx)
      return this.err(
        PaymeError.TRANSACTION_NOT_FOUND,
        'TRANSACTION_NOT_FOUND',
      );
    return {
      result: {
        create_time: tx.createdAt.getTime(),
        perform_time: tx.performedAt?.getTime() ?? 0,
        cancel_time: tx.cancelledAt?.getTime() ?? 0,
        transaction: tx.id,
        state: tx.state ?? 0,
        reason: tx.cancelReason ?? null,
      },
    };
  }

  private async getStatement(
    params: Record<string, unknown>,
  ): Promise<PaymeResponse> {
    const from = this.asNumber(params.from);
    const to = this.asNumber(params.to);
    const rows = await this.prisma.transaction.findMany({
      where: {
        provider: PaymentProvider.PAYME,
        providerTxId: { not: null },
        createdAt: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      result: {
        transactions: rows.map((r) => ({
          id: r.providerTxId,
          time: r.createdAt.getTime(),
          amount: somToTiyin(r.amount).toNumber(),
          account: this.parseAccount(r.reference),
          create_time: r.createdAt.getTime(),
          perform_time: r.performedAt?.getTime() ?? 0,
          cancel_time: r.cancelledAt?.getTime() ?? 0,
          transaction: r.id,
          state: r.state ?? 0,
          reason: r.cancelReason ?? null,
        })),
      },
    };
  }

  // ---- yordamchilar ----

  /** Yakunlangan to'lovni teskari qaytaradi (refund) — invoice kreditini ayiradi. */
  private async reversePerformedTransaction(
    tx: TxRow,
    reason: number,
    cancelledAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.CANCELLED,
          state: PaymeState.CANCELLED_AFTER_PERFORM,
          cancelReason: Number.isFinite(reason) ? reason : null,
          cancelledAt,
        },
      });

      const invoice = await db.invoice.findFirst({
        where: { id: tx.invoiceId },
      });
      if (invoice) {
        const newPaid = invoice.paidAmount.minus(tx.amount);
        const paid = newPaid.lessThan(0) ? new Prisma.Decimal(0) : newPaid;
        const debt = invoice.totalAmount.minus(paid);
        const status = paid.lessThanOrEqualTo(0)
          ? InvoiceStatus.UNPAID
          : InvoiceStatus.PARTIAL;
        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: paid,
            debtAmount: debt,
            status,
            paidAt: null,
          },
        });
      }
    });

    await this.auditService.log({
      action: 'PAYME_CANCEL_REFUND',
      entity: 'Transaction',
      entityId: tx.id,
      actorType: ActorType.SYSTEM,
      clinicId: tx.clinicId,
      metadata: {
        invoiceId: tx.invoiceId,
        amount: tx.amount.toString(),
        reason,
      },
    });
  }

  private async findByPaycomId(paycomId: string): Promise<TxRow | null> {
    if (!paycomId) return null;
    return this.prisma.transaction.findFirst({
      where: { provider: PaymentProvider.PAYME, providerTxId: paycomId },
    });
  }

  private async findInvoice(invoiceId: string) {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });
  }

  /** Invoice yopiq holatda bo'lsa tegishli xato (paid/cancelled). */
  private settledError(status: string): PaymeResponse | null {
    if (status === InvoiceStatus.PAID || status === InvoiceStatus.CANCELLED) {
      return this.err(PaymeError.ACCOUNT_ALREADY_PAID, 'ACCOUNT_ALREADY_PAID');
    }
    return null;
  }

  private accountInvoiceId(params: Record<string, unknown>): string | null {
    const account = params.account;
    if (!account || typeof account !== 'object') return null;
    const value = (account as Record<string, unknown>)[this.cfg.accountField];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private accountError(): PaymeResponse {
    return this.err(
      PaymeError.ACCOUNT_NOT_FOUND,
      'ACCOUNT_NOT_FOUND',
      this.cfg.accountField,
    );
  }

  private err(
    code: number,
    messageKey?: keyof typeof PAYME_MESSAGES,
    data?: unknown,
  ): PaymeResponse {
    const message = messageKey
      ? PAYME_MESSAGES[messageKey]
      : { ru: 'Ошибка', uz: 'Xato', en: 'Error' };
    return { error: { code, message, data } };
  }

  private parseAccount(reference: string | null): Record<string, unknown> {
    if (!reference) return {};
    try {
      const parsed: unknown = JSON.parse(reference);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isNaN(n) ? NaN : n;
    }
    return NaN;
  }

  private json(params: Record<string, unknown>): Prisma.InputJsonValue {
    return params as unknown as Prisma.InputJsonValue;
  }
}
