import { Prisma } from '@prisma/client';
import { PaymeError, PaymeState } from '../constants/billing.constant';
import { PaymeService } from './payme.service';

/**
 * Payme JSON-RPC protokoli + idempotency (DoD). DB'siz — mock prisma.
 */
describe('PaymeService', () => {
  const MERCHANT_KEY = 'super-secret-merchant-key';

  function makeService(prisma: Record<string, unknown>) {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({
        merchantId: 'm1',
        merchantKey: MERCHANT_KEY,
        testKey: undefined,
        accountField: 'invoice_id',
      }),
    };
    const payments = {
      confirmPayment: jest.fn().mockResolvedValue({
        transactionId: 't1',
        invoiceStatus: 'PAID',
        fullyPaid: true,
        paidAmount: '1990',
        debtAmount: '0',
        alreadyApplied: false,
      }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymeService(
      prisma as never,
      config as never,
      payments as never,
      audit as never,
    );
    return { service, payments, audit };
  }

  function basic(login: string, password: string): string {
    return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
  }

  it('checkAuth: to`g`ri merchant key -> true, aks holda false', () => {
    const { service } = makeService({});
    expect(service.checkAuth(basic('Paycom', MERCHANT_KEY))).toBe(true);
    expect(service.checkAuth(basic('Paycom', 'wrong'))).toBe(false);
    expect(service.checkAuth(basic('Other', MERCHANT_KEY))).toBe(false);
    expect(service.checkAuth(undefined)).toBe(false);
  });

  it('CheckPerformTransaction: summa to`g`ri -> allow', async () => {
    const { service } = makeService({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv1',
          status: 'UNPAID',
          debtAmount: new Prisma.Decimal('1990'),
        }),
      },
    });
    const res = await service.dispatch('CheckPerformTransaction', {
      amount: 199000,
      account: { invoice_id: 'inv1' },
    });
    expect(res).toEqual({ result: { allow: true } });
  });

  it('CheckPerformTransaction: noto`g`ri summa -> -31001', async () => {
    const { service } = makeService({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv1',
          status: 'UNPAID',
          debtAmount: new Prisma.Decimal('1990'),
        }),
      },
    });
    const res = await service.dispatch('CheckPerformTransaction', {
      amount: 100000,
      account: { invoice_id: 'inv1' },
    });
    expect('error' in res && res.error.code).toBe(PaymeError.INVALID_AMOUNT);
  });

  it('CheckPerformTransaction: account yo`q -> -31050 (data=field)', async () => {
    const { service } = makeService({
      invoice: { findFirst: jest.fn() },
    });
    const res = await service.dispatch('CheckPerformTransaction', {
      amount: 199000,
      account: {},
    });
    expect('error' in res && res.error.code).toBe(PaymeError.ACCOUNT_NOT_FOUND);
    expect('error' in res && res.error.data).toBe('invoice_id');
  });

  it('CreateTransaction: yangi tranzaksiya yaratadi (state=1)', async () => {
    const createdAt = new Date('2026-06-05T10:00:00Z');
    const { service } = makeService({
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 't1', createdAt }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv1',
          clinicId: 'cl1',
          status: 'UNPAID',
          debtAmount: new Prisma.Decimal('1990'),
        }),
      },
    });
    const res = await service.dispatch('CreateTransaction', {
      id: 'pay1',
      time: Date.now(),
      amount: 199000,
      account: { invoice_id: 'inv1' },
    });
    expect('result' in res && res.result.state).toBe(PaymeState.CREATED);
    expect('result' in res && res.result.transaction).toBe('t1');
    expect('result' in res && res.result.create_time).toBe(createdAt.getTime());
  });

  it('CreateTransaction: takroriy id (idempotent) -> mavjudni qaytaradi, create chaqirilmaydi', async () => {
    const createdAt = new Date('2026-06-05T10:00:00Z');
    const create = jest.fn();
    const { service } = makeService({
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          state: PaymeState.CREATED,
          createdAt,
        }),
        create,
      },
      invoice: { findFirst: jest.fn() },
    });
    const res = await service.dispatch('CreateTransaction', {
      id: 'pay1',
      time: Date.now(),
      amount: 199000,
      account: { invoice_id: 'inv1' },
    });
    expect('result' in res && res.result.transaction).toBe('t1');
    expect(create).not.toHaveBeenCalled();
  });

  it('PerformTransaction: to`lovni qo`llaydi (state=2)', async () => {
    const createdAt = new Date();
    const performedAt = new Date();
    const { service, payments } = makeService({
      transaction: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 't1',
            state: PaymeState.CREATED,
            clinicId: 'cl1',
            invoiceId: 'inv1',
            amount: new Prisma.Decimal('1990'),
            createdAt,
          })
          .mockResolvedValueOnce({
            id: 't1',
            state: PaymeState.PERFORMED,
            performedAt,
          }),
        update: jest.fn(),
      },
    });
    const res = await service.dispatch('PerformTransaction', { id: 'pay1' });
    expect('result' in res && res.result.state).toBe(PaymeState.PERFORMED);
    expect(payments.confirmPayment).toHaveBeenCalledTimes(1);
    const call = payments.confirmPayment.mock.calls[0][0];
    expect(call.existingTransactionId).toBe('t1');
    expect(call.providerState).toBe(PaymeState.PERFORMED);
  });

  it('PerformTransaction: allaqachon yakunlangan (idempotent) -> confirmPayment chaqirilmaydi', async () => {
    const performedAt = new Date();
    const { service, payments } = makeService({
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          state: PaymeState.PERFORMED,
          performedAt,
        }),
      },
    });
    const res = await service.dispatch('PerformTransaction', { id: 'pay1' });
    expect('result' in res && res.result.state).toBe(PaymeState.PERFORMED);
    expect(payments.confirmPayment).not.toHaveBeenCalled();
  });

  it('PerformTransaction: tranzaksiya topilmadi -> -31003', async () => {
    const { service } = makeService({
      transaction: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const res = await service.dispatch('PerformTransaction', { id: 'yoq' });
    expect('error' in res && res.error.code).toBe(
      PaymeError.TRANSACTION_NOT_FOUND,
    );
  });
});
