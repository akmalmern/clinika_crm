import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { InjectPrisma } from '../../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../../core/prisma/prisma-extensions';
import { ClickConfig } from '../../../config/configuration';
import { ActorType } from '../../../common/constants/roles.constant';
import { AuditService } from '../../audit/audit.service';
import {
  ClickAction,
  ClickError,
  InvoiceStatus,
  PaymentProvider,
  TransactionStatus,
} from '../constants/billing.constant';
import { moneyEquals } from '../billing.util';
import { PaymentApplicationService } from './payment-application.service';

/** Click webhook'idan keladigan parametrlar (form-urlencoded). */
export interface ClickParams {
  click_trans_id?: string;
  service_id?: string;
  click_paydoc_id?: string;
  merchant_trans_id?: string; // bizning invoice id
  merchant_prepare_id?: string; // faqat Complete'da
  amount?: string;
  action?: string;
  error?: string;
  error_note?: string;
  sign_time?: string;
  sign_string?: string;
}

export interface ClickResponse {
  click_trans_id: number | string;
  merchant_trans_id: string;
  merchant_prepare_id?: number | string;
  merchant_confirm_id?: number | string;
  error: number;
  error_note: string;
}

/**
 * Click Merchant API (spec 5.4) — Prepare(action=0) / Complete(action=1).
 * Imzo (sign_string) MD5 bilan tekshiriladi; idempotency click_trans_id bo'yicha.
 *  - Prepare: imzo + invoice + summa tekshiruvi -> PENDING tranzaksiya + merchant_prepare_id.
 *  - Complete: imzo + prepare moslik -> to'lov qo'llanadi (invoice PAID/PARTIAL).
 * Bu servis throw qilmaydi — har doim Click formatidagi javob qaytaradi.
 */
@Injectable()
export class ClickService {
  private readonly logger = new Logger('Click');
  private readonly cfg: ClickConfig;

  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    config: ConfigService,
    private readonly payments: PaymentApplicationService,
    private readonly auditService: AuditService,
  ) {
    this.cfg = config.getOrThrow<ClickConfig>('click');
  }

  async handle(params: ClickParams): Promise<ClickResponse> {
    const action = Number(params.action);
    if (action === ClickAction.PREPARE) return this.prepare(params);
    if (action === ClickAction.COMPLETE) return this.complete(params);
    return this.fail(params, ClickError.ACTION_NOT_FOUND, 'Action not found');
  }

  // ---- Prepare (action=0) ----
  private async prepare(params: ClickParams): Promise<ClickResponse> {
    if (!this.verifyPrepareSign(params)) {
      return this.fail(params, ClickError.SIGN_CHECK_FAILED, 'SIGN CHECK FAILED');
    }
    const invoiceId = params.merchant_trans_id ?? '';
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });
    if (!invoice) {
      return this.fail(params, ClickError.USER_NOT_FOUND, 'Invoice not found');
    }
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      return this.fail(params, ClickError.ALREADY_PAID, 'Already paid');
    }
    if (!moneyEquals(params.amount ?? '0', invoice.debtAmount)) {
      return this.fail(params, ClickError.INCORRECT_AMOUNT, 'Incorrect amount');
    }

    const clickTransId = params.click_trans_id ?? '';
    // Idempotent: shu click_trans_id avval tayyorlanganmi?
    const existing = await this.findByClickId(clickTransId);
    if (existing) {
      if (existing.status === TransactionStatus.PAID) {
        return this.fail(params, ClickError.ALREADY_PAID, 'Already paid');
      }
      const prepareId = this.readPrepareId(existing.raw);
      return this.ok(params, { merchant_prepare_id: prepareId ?? existing.id });
    }

    const prepareId = Date.now();
    try {
      await this.prisma.transaction.create({
        data: {
          clinicId: invoice.clinicId,
          invoiceId: invoice.id,
          provider: PaymentProvider.CLICK,
          method: 'ONLINE',
          providerTxId: clickTransId,
          reference: invoiceId,
          amount: new Prisma.Decimal(params.amount ?? '0'),
          status: TransactionStatus.PENDING,
          raw: { prepare: this.json(params), merchant_prepare_id: prepareId },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await this.findByClickId(clickTransId);
        const pid = again ? this.readPrepareId(again.raw) : prepareId;
        return this.ok(params, { merchant_prepare_id: pid ?? prepareId });
      }
      throw err;
    }

    return this.ok(params, { merchant_prepare_id: prepareId });
  }

  // ---- Complete (action=1) ----
  private async complete(params: ClickParams): Promise<ClickResponse> {
    if (!this.verifyCompleteSign(params)) {
      return this.fail(params, ClickError.SIGN_CHECK_FAILED, 'SIGN CHECK FAILED');
    }
    const clickTransId = params.click_trans_id ?? '';
    const tx = await this.findByClickId(clickTransId);
    if (!tx) {
      return this.fail(
        params,
        ClickError.TRANSACTION_NOT_FOUND,
        'Transaction not found',
      );
    }

    const prepareId = this.readPrepareId(tx.raw);
    if (
      prepareId === null ||
      String(prepareId) !== String(params.merchant_prepare_id ?? '')
    ) {
      return this.fail(
        params,
        ClickError.TRANSACTION_NOT_FOUND,
        'Prepare not found',
      );
    }

    // Click manfiy `error` yuborsa — bekor.
    const incomingError = Number(params.error ?? 0);
    if (incomingError < 0) {
      await this.cancel(tx.id, incomingError);
      return this.fail(
        params,
        ClickError.TRANSACTION_CANCELLED,
        'Transaction cancelled',
      );
    }

    // Idempotent: allaqachon to'langan.
    if (tx.status === TransactionStatus.PAID) {
      return this.fail(params, ClickError.ALREADY_PAID, 'Already paid');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: tx.invoiceId, deletedAt: null },
    });
    if (!invoice) {
      return this.fail(params, ClickError.USER_NOT_FOUND, 'Invoice not found');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      return this.fail(params, ClickError.ALREADY_PAID, 'Already paid');
    }
    if (!moneyEquals(tx.amount, invoice.debtAmount)) {
      return this.fail(params, ClickError.INCORRECT_AMOUNT, 'Incorrect amount');
    }

    await this.payments.confirmPayment({
      clinicId: tx.clinicId,
      invoiceId: tx.invoiceId,
      amount: tx.amount,
      provider: PaymentProvider.CLICK,
      providerTxId: clickTransId,
      existingTransactionId: tx.id,
      raw: { complete: this.json(params), merchant_prepare_id: prepareId },
    });

    await this.auditService.log({
      action: 'CLICK_COMPLETE',
      entity: 'Transaction',
      entityId: tx.id,
      actorType: ActorType.SYSTEM,
      clinicId: tx.clinicId,
      metadata: { invoiceId: tx.invoiceId, amount: tx.amount.toString() },
    });

    return this.ok(params, { merchant_confirm_id: prepareId });
  }

  // ---- imzo (MD5) ----

  private verifyPrepareSign(p: ClickParams): boolean {
    const raw =
      `${p.click_trans_id ?? ''}${p.service_id ?? ''}${this.cfg.secretKey}` +
      `${p.merchant_trans_id ?? ''}${p.amount ?? ''}${p.action ?? ''}${p.sign_time ?? ''}`;
    return this.md5Equals(raw, p.sign_string);
  }

  private verifyCompleteSign(p: ClickParams): boolean {
    const raw =
      `${p.click_trans_id ?? ''}${p.service_id ?? ''}${this.cfg.secretKey}` +
      `${p.merchant_trans_id ?? ''}${p.merchant_prepare_id ?? ''}${p.amount ?? ''}` +
      `${p.action ?? ''}${p.sign_time ?? ''}`;
    return this.md5Equals(raw, p.sign_string);
  }

  private md5Equals(raw: string, provided?: string): boolean {
    if (!provided) return false;
    const expected = createHash('md5').update(raw).digest('hex');
    return expected.toLowerCase() === provided.toLowerCase();
  }

  // ---- yordamchilar ----

  private async cancel(txId: string, errorCode: number): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: txId },
      data: {
        status: TransactionStatus.CANCELLED,
        cancelReason: errorCode,
        cancelledAt: new Date(),
      },
    });
  }

  private async findByClickId(clickTransId: string) {
    if (!clickTransId) return null;
    return this.prisma.transaction.findFirst({
      where: { provider: PaymentProvider.CLICK, providerTxId: clickTransId },
    });
  }

  private readPrepareId(raw: Prisma.JsonValue): number | null {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const value = (raw as Record<string, unknown>).merchant_prepare_id;
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.length > 0) return Number(value);
    }
    return null;
  }

  private ok(
    p: ClickParams,
    extra: Partial<ClickResponse>,
  ): ClickResponse {
    return {
      click_trans_id: p.click_trans_id ?? '',
      merchant_trans_id: p.merchant_trans_id ?? '',
      error: ClickError.SUCCESS,
      error_note: 'Success',
      ...extra,
    };
  }

  private fail(p: ClickParams, code: number, note: string): ClickResponse {
    return {
      click_trans_id: p.click_trans_id ?? '',
      merchant_trans_id: p.merchant_trans_id ?? '',
      error: code,
      error_note: note,
    };
  }

  private json(p: ClickParams): Prisma.InputJsonValue {
    return p as unknown as Prisma.InputJsonValue;
  }
}
