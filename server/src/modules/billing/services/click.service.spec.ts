import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClickError } from '../constants/billing.constant';
import { ClickService } from './click.service';

const SECRET = 'click-secret-key';

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

describe('ClickService (Prepare/Complete + MD5 sign)', () => {
  function makeService(prisma: Record<string, unknown>) {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({
        serviceId: 'svc',
        merchantId: 'm1',
        secretKey: SECRET,
        merchantUserId: 'u1',
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
    const service = new ClickService(
      prisma as never,
      config as never,
      payments as never,
      audit as never,
    );
    return { service, payments, audit };
  }

  const base = {
    click_trans_id: '111',
    service_id: 'svc',
    merchant_trans_id: 'inv1',
    amount: '1990.00',
    sign_time: '2026-06-05 10:00:00',
  };

  function prepareSign(): string {
    return md5(
      `${base.click_trans_id}${base.service_id}${SECRET}${base.merchant_trans_id}${base.amount}0${base.sign_time}`,
    );
  }

  function completeSign(prepareId: string): string {
    return md5(
      `${base.click_trans_id}${base.service_id}${SECRET}${base.merchant_trans_id}${prepareId}${base.amount}1${base.sign_time}`,
    );
  }

  it('Prepare: to`g`ri imzo -> PENDING tranzaksiya + error 0', async () => {
    const create = jest.fn().mockResolvedValue({ id: 't1' });
    const { service } = makeService({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv1',
          clinicId: 'cl1',
          status: 'UNPAID',
          debtAmount: new Prisma.Decimal('1990.00'),
        }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    });

    const res = await service.handle({
      ...base,
      action: '0',
      sign_string: prepareSign(),
    });

    expect(res.error).toBe(ClickError.SUCCESS);
    expect(res.merchant_prepare_id).toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('Prepare: imzo noto`g`ri -> -1 SIGN CHECK FAILED', async () => {
    const { service } = makeService({
      invoice: { findFirst: jest.fn() },
      transaction: { findFirst: jest.fn(), create: jest.fn() },
    });
    const res = await service.handle({
      ...base,
      action: '0',
      sign_string: 'deadbeef',
    });
    expect(res.error).toBe(ClickError.SIGN_CHECK_FAILED);
  });

  it('Complete: to`g`ri imzo + prepare moslik -> to`lov qo`llanadi (error 0)', async () => {
    const prepareId = 555;
    const { service, payments } = makeService({
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          clinicId: 'cl1',
          invoiceId: 'inv1',
          status: 'PENDING',
          amount: new Prisma.Decimal('1990.00'),
          raw: { merchant_prepare_id: prepareId },
        }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv1',
          status: 'UNPAID',
          debtAmount: new Prisma.Decimal('1990.00'),
        }),
      },
    });

    const res = await service.handle({
      ...base,
      action: '1',
      merchant_prepare_id: String(prepareId),
      sign_string: completeSign(String(prepareId)),
    });

    expect(res.error).toBe(ClickError.SUCCESS);
    expect(res.merchant_confirm_id).toBe(prepareId);
    expect(payments.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('Complete: allaqachon to`langan -> -4 ALREADY_PAID', async () => {
    const prepareId = 555;
    const { service, payments } = makeService({
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 't1',
          clinicId: 'cl1',
          invoiceId: 'inv1',
          status: 'PAID',
          amount: new Prisma.Decimal('1990.00'),
          raw: { merchant_prepare_id: prepareId },
        }),
      },
      invoice: { findFirst: jest.fn() },
    });

    const res = await service.handle({
      ...base,
      action: '1',
      merchant_prepare_id: String(prepareId),
      sign_string: completeSign(String(prepareId)),
    });

    expect(res.error).toBe(ClickError.ALREADY_PAID);
    expect(payments.confirmPayment).not.toHaveBeenCalled();
  });
});
