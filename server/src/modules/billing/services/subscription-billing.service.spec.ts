import { Prisma } from '@prisma/client';
import {
  computeBillingPeriod,
  SubscriptionBillingService,
} from './subscription-billing.service';

describe('computeBillingPeriod (sof)', () => {
  it('MONTHLY: period_end +1 oy, grace/due +graceDays', () => {
    const p = computeBillingPeriod(
      new Date('2026-06-01T00:00:00Z'),
      'MONTHLY',
      3,
    );
    expect(p.periodStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(p.periodEnd.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(p.dueDate.toISOString()).toBe('2026-06-04T00:00:00.000Z');
    expect(p.graceUntil.toISOString()).toBe('2026-06-04T00:00:00.000Z');
  });
});

describe('SubscriptionBillingService.runDailyBilling', () => {
  it('muddati kelganga invoice yaratadi; grace o`tganni SUSPENDED qiladi', async () => {
    const dueSub = {
      id: 'sub1',
      clinicId: 'cl1',
      nextBillingDate: new Date('2026-06-01T00:00:00Z'),
      status: 'ACTIVE',
      plan: {
        id: 'p1',
        price: new Prisma.Decimal('199000.00'),
        currency: 'UZS',
        billingCycle: 'MONTHLY',
      },
    };
    const overdueSub = {
      id: 'sub2',
      clinicId: 'cl2',
      graceUntil: new Date('2026-05-20T00:00:00Z'),
      status: 'PAST_DUE',
    };

    const tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null), // shu davr invoice'i yo'q
        create: jest.fn().mockResolvedValue({ id: 'inv1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscription: { update: jest.fn().mockResolvedValue({}) },
      clinic: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    const prisma = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([dueSub]) // 1) muddati kelganlar
          .mockResolvedValueOnce([overdueSub]), // 2) grace o'tganlar
      },
      invoice: {
        // suspendIfUnpaid: to'lanmagan invoice bor
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'inv2', status: 'UNPAID' }),
      },
      $transaction: jest.fn(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      ),
    };

    const config = {
      getOrThrow: jest.fn().mockReturnValue({ graceDays: 3 }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new SubscriptionBillingService(
      prisma as never,
      config as never,
      audit as never,
    );

    const result = await service.runDailyBilling(
      new Date('2026-06-05T00:00:00Z'),
    );

    expect(result.invoicesCreated).toBe(1);
    expect(result.clinicsSuspended).toBe(1);

    // Invoice to'g'ri yaratildi:
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    const invData = tx.invoice.create.mock.calls[0][0].data;
    expect(invData.status).toBe('UNPAID');
    expect(invData.totalAmount).toBe(dueSub.plan.price);
    expect(invData.debtAmount).toBe(dueSub.plan.price);
    expect((invData.periodStart as Date).toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    );

    // Obuna PAST_DUE bo'ldi (invoice yaratilganda):
    const subUpdateData = tx.subscription.update.mock.calls.find(
      (c: unknown[]) =>
        (c[0] as { data: { status: string } }).data.status === 'PAST_DUE',
    );
    expect(subUpdateData).toBeDefined();

    // Suspend: klinika SUSPENDED + invoice OVERDUE:
    const clinicSuspend = tx.clinic.updateMany.mock.calls.find(
      (c: unknown[]) =>
        (c[0] as { data: { status: string } }).data.status === 'SUSPENDED',
    );
    expect(clinicSuspend).toBeDefined();

    // Audit: invoice + suspend yozildi
    const actions = audit.log.mock.calls.map(
      (c: unknown[]) => (c[0] as { action: string }).action,
    );
    expect(actions).toContain('INVOICE_GENERATED');
    expect(actions).toContain('CLINIC_SUSPENDED_NONPAYMENT');
  });

  it('idempotent: shu davr invoice mavjud bo`lsa qayta yaratmaydi', async () => {
    const dueSub = {
      id: 'sub1',
      clinicId: 'cl1',
      nextBillingDate: new Date('2026-06-01T00:00:00Z'),
      status: 'PAST_DUE',
      plan: {
        price: new Prisma.Decimal('199000.00'),
        currency: 'UZS',
        billingCycle: 'MONTHLY',
      },
    };
    const tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), // bor!
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      subscription: { update: jest.fn() },
      clinic: { updateMany: jest.fn() },
    };
    const prisma = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([dueSub])
          .mockResolvedValueOnce([]),
      },
      invoice: { findFirst: jest.fn() },
      $transaction: jest.fn(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      ),
    };
    const config = { getOrThrow: jest.fn().mockReturnValue({ graceDays: 3 }) };
    const audit = { log: jest.fn() };

    const service = new SubscriptionBillingService(
      prisma as never,
      config as never,
      audit as never,
    );

    const result = await service.runDailyBilling(
      new Date('2026-06-05T00:00:00Z'),
    );

    expect(result.invoicesCreated).toBe(0);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
