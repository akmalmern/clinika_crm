import { Prisma } from '@prisma/client';
import { PaymentApplicationService } from './payment-application.service';

/**
 * confirmPayment yadrosi (DB'siz, mock prisma). DoD:
 *  - to'liq to'langanda obuna uzayadi + SUSPENDED -> ACTIVE,
 *  - qisman to'lovda PARTIAL (obuna uzaymaydi),
 *  - idempotent (PAID tranzaksiya qayta qo'llanmaydi).
 */
describe('PaymentApplicationService.confirmPayment', () => {
  function makeTx(overrides: {
    invoice: Record<string, unknown>;
    subscription?: Record<string, unknown> | null;
    existingTransaction?: Record<string, unknown> | null;
    updatedInvoice?: Record<string, unknown>;
  }) {
    const tx = {
      transaction: {
        findFirst: jest
          .fn()
          .mockResolvedValue(overrides.existingTransaction ?? null),
        create: jest.fn().mockResolvedValue({ id: 'tx1', status: 'PAID' }),
        update: jest.fn().mockResolvedValue({ id: 'tx1', status: 'PAID' }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(overrides.invoice),
        update: jest
          .fn()
          .mockResolvedValue(overrides.updatedInvoice ?? overrides.invoice),
      },
      subscription: {
        findFirst: jest
          .fn()
          .mockResolvedValue(overrides.subscription ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      clinic: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    return tx;
  }

  function makeService(tx: ReturnType<typeof makeTx>) {
    const prisma = {
      $transaction: jest.fn(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      ),
    };
    return new PaymentApplicationService(prisma as never);
  }

  it("to'liq to'lov: invoice PAID + obuna uzayadi + SUSPENDED->ACTIVE", async () => {
    const invoice = {
      id: 'inv1',
      clinicId: 'cl1',
      subscriptionId: 'sub1',
      status: 'UNPAID',
      totalAmount: new Prisma.Decimal('199000'),
      paidAmount: new Prisma.Decimal('0'),
      debtAmount: new Prisma.Decimal('199000'),
      periodEnd: new Date('2026-07-01T00:00:00Z'),
      paidAt: null,
    };
    const tx = makeTx({
      invoice,
      subscription: {
        id: 'sub1',
        nextBillingDate: new Date('2026-06-01T00:00:00Z'),
        plan: { billingCycle: 'MONTHLY' },
      },
      updatedInvoice: {
        ...invoice,
        status: 'PAID',
        paidAmount: new Prisma.Decimal('199000'),
        debtAmount: new Prisma.Decimal('0'),
      },
    });
    const service = makeService(tx);

    const res = await service.confirmPayment({
      clinicId: 'cl1',
      invoiceId: 'inv1',
      amount: new Prisma.Decimal('199000'),
      provider: 'PAYME',
    });

    expect(res.fullyPaid).toBe(true);
    expect(res.invoiceStatus).toBe('PAID');

    // Obuna uzaytirildi:
    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
    const subData = tx.subscription.update.mock.calls[0][0].data;
    expect(subData.status).toBe('ACTIVE');
    expect(subData.graceUntil).toBeNull();
    expect((subData.nextBillingDate as Date).toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );

    // Klinika SUSPENDED -> ACTIVE (where.status.in SUSPENDED bor):
    expect(tx.clinic.updateMany).toHaveBeenCalledTimes(1);
    const clinicCall = tx.clinic.updateMany.mock.calls[0][0];
    expect(clinicCall.data.status).toBe('ACTIVE');
    expect(clinicCall.where.status.in).toContain('SUSPENDED');
  });

  it("qisman to'lov: PARTIAL, obuna uzaymaydi", async () => {
    const invoice = {
      id: 'inv1',
      clinicId: 'cl1',
      subscriptionId: 'sub1',
      status: 'UNPAID',
      totalAmount: new Prisma.Decimal('199000'),
      paidAmount: new Prisma.Decimal('0'),
      debtAmount: new Prisma.Decimal('199000'),
      paidAt: null,
    };
    const tx = makeTx({
      invoice,
      updatedInvoice: {
        ...invoice,
        status: 'PARTIAL',
        paidAmount: new Prisma.Decimal('100000'),
        debtAmount: new Prisma.Decimal('99000'),
      },
    });
    const service = makeService(tx);

    const res = await service.confirmPayment({
      clinicId: 'cl1',
      invoiceId: 'inv1',
      amount: new Prisma.Decimal('100000'),
      provider: 'MANUAL',
      method: 'CASH',
    });

    expect(res.fullyPaid).toBe(false);
    expect(res.invoiceStatus).toBe('PARTIAL');
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.clinic.updateMany).not.toHaveBeenCalled();
  });

  it('idempotent: PAID tranzaksiya qayta qo`llanmaydi', async () => {
    const invoice = {
      id: 'inv1',
      clinicId: 'cl1',
      subscriptionId: null,
      status: 'PAID',
      totalAmount: new Prisma.Decimal('199000'),
      paidAmount: new Prisma.Decimal('199000'),
      debtAmount: new Prisma.Decimal('0'),
      paidAt: new Date(),
    };
    const tx = makeTx({
      invoice,
      existingTransaction: { id: 'tx1', status: 'PAID', state: 2, raw: {} },
    });
    const service = makeService(tx);

    const res = await service.confirmPayment({
      clinicId: 'cl1',
      invoiceId: 'inv1',
      amount: new Prisma.Decimal('199000'),
      provider: 'PAYME',
      existingTransactionId: 'tx1',
    });

    expect(res.alreadyApplied).toBe(true);
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });
});
