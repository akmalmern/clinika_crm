import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ManualPaymentService } from './manual-payment.service';

describe('ManualPaymentService (SUPER_ADMIN qo`lda to`lov)', () => {
  function build(invoice: Record<string, unknown> | null) {
    const prisma = {
      invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
    };
    const payments = {
      confirmPayment: jest.fn().mockResolvedValue({
        transactionId: 'tx1',
        invoiceStatus: 'PAID',
        fullyPaid: true,
        paidAmount: '199000',
        debtAmount: '0',
        alreadyApplied: false,
      }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ManualPaymentService(
      prisma as never,
      payments as never,
      audit as never,
    );
    return { service, prisma, payments, audit };
  }

  const unpaidInvoice = {
    id: 'inv1',
    clinicId: 'cl1',
    status: 'UNPAID',
    debtAmount: new Prisma.Decimal('199000'),
  };

  it('naqd to`lovni qayd etadi: MANUAL + confirmedBy + audit majburiy', async () => {
    const { service, payments, audit } = build(unpaidInvoice);

    const res = await service.record(
      {
        invoiceId: 'inv1',
        amount: '199000',
        method: 'CASH',
        reference: 'PKO-12',
      },
      'admin-1',
    );

    expect(res.invoiceStatus).toBe('PAID');

    // confirmPayment MANUAL provider + confirmedBy bilan chaqirildi:
    const call = payments.confirmPayment.mock.calls[0][0];
    expect(call.provider).toBe('MANUAL');
    expect(call.method).toBe('CASH');
    expect(call.confirmedBy).toBe('admin-1');
    expect(call.amount.toString()).toBe('199000');

    // AUDIT MAJBURIY:
    expect(audit.log).toHaveBeenCalledTimes(1);
    const a = audit.log.mock.calls[0][0];
    expect(a.action).toBe('MANUAL_PAYMENT');
    expect(a.userId).toBe('admin-1');
    expect(a.metadata.method).toBe('CASH');
    expect(a.metadata.amount).toBe('199000');
  });

  it('PAID invoice`ga qayta to`liq to`lov yo`q -> Conflict', async () => {
    const { service, payments } = build({
      ...unpaidInvoice,
      status: 'PAID',
      debtAmount: new Prisma.Decimal('0'),
    });
    await expect(
      service.record(
        { invoiceId: 'inv1', amount: '199000', method: 'CASH' },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(payments.confirmPayment).not.toHaveBeenCalled();
  });

  it('qoldiqdan oshiq summa -> BadRequest', async () => {
    const { service, payments } = build(unpaidInvoice);
    await expect(
      service.record(
        { invoiceId: 'inv1', amount: '200000', method: 'CASH' },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(payments.confirmPayment).not.toHaveBeenCalled();
  });
});
