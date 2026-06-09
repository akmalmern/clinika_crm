import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashierService } from './cashier.service';

/**
 * CashierService (DB'siz, mock). DoD: qisman to'lov (debt to'g'ri kamayadi,
 * status UNPAID->PARTIAL->PAID), ortiqcha to'lov rad etiladi, invoice idempotent.
 */
describe('CashierService', () => {
  function build(tx: Record<string, unknown>, top?: Record<string, unknown>) {
    const prisma = {
      ...top,
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(tx),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CashierService(prisma as never, audit as never);
    return { service, prisma, audit };
  }

  const invoice = {
    id: 'inv1',
    clinicId: 'cl1',
    patientId: 'p1',
    appointmentId: null,
    totalAmount: new Prisma.Decimal('150000'),
    paidAmount: new Prisma.Decimal('0'),
    debtAmount: new Prisma.Decimal('150000'),
    currency: 'UZS',
    status: 'UNPAID',
    createdAt: new Date(),
  };

  it("qisman to'lov: debt kamayadi, status PARTIAL", async () => {
    const tx = {
      patientInvoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest
          .fn()
          .mockImplementation((args: { data: unknown }) =>
            Promise.resolve({ ...invoice, ...(args.data as object) }),
          ),
      },
      patientPayment: {
        create: jest.fn().mockResolvedValue({
          id: 'pay1',
          patientInvoiceId: 'inv1',
          amount: new Prisma.Decimal('50000'),
          method: 'CASH',
          status: 'COMPLETED',
          paidAt: new Date(),
          cashierId: 'c1',
        }),
      },
    };
    const { service } = build(tx);
    const res = await service.pay(
      'cl1',
      'inv1',
      { amount: '50000', method: 'CASH' },
      'c1',
    );
    const updateData = tx.patientInvoice.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('PARTIAL');
    expect(updateData.paidAmount.toString()).toBe('50000');
    expect(updateData.debtAmount.toString()).toBe('100000');
    expect(res.payment.amount).toBe('50000');
  });

  it("to'liq to'lov: status PAID, debt 0", async () => {
    const tx = {
      patientInvoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest
          .fn()
          .mockImplementation((args: { data: unknown }) =>
            Promise.resolve({ ...invoice, ...(args.data as object) }),
          ),
      },
      patientPayment: {
        create: jest.fn().mockResolvedValue({
          id: 'pay2',
          patientInvoiceId: 'inv1',
          amount: new Prisma.Decimal('150000'),
          method: 'CARD',
          status: 'COMPLETED',
          paidAt: new Date(),
          cashierId: 'c1',
        }),
      },
    };
    const { service } = build(tx);
    await service.pay(
      'cl1',
      'inv1',
      { amount: '150000', method: 'CARD' },
      'c1',
    );
    const updateData = tx.patientInvoice.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('PAID');
    expect(updateData.debtAmount.toString()).toBe('0');
  });

  it('ortiqcha to`lov rad etiladi -> BadRequest', async () => {
    const tx = {
      patientInvoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest.fn(),
      },
      patientPayment: { create: jest.fn() },
    };
    const { service } = build(tx);
    await expect(
      service.pay('cl1', 'inv1', { amount: '200000', method: 'CASH' }, 'c1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.patientPayment.create).not.toHaveBeenCalled();
  });

  it("to'langan invoice'ga qayta to'lov -> Conflict", async () => {
    const paid = {
      ...invoice,
      status: 'PAID',
      debtAmount: new Prisma.Decimal('0'),
    };
    const tx = {
      patientInvoice: {
        findFirst: jest.fn().mockResolvedValue(paid),
        update: jest.fn(),
      },
      patientPayment: { create: jest.fn() },
    };
    const { service } = build(tx);
    await expect(
      service.pay('cl1', 'inv1', { amount: '1000', method: 'CASH' }, 'c1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('createInvoiceForAppointment idempotent (mavjudni qaytaradi)', async () => {
    const create = jest.fn();
    const { service } = build(
      {},
      {
        patientInvoice: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
          create,
        },
      },
    );
    const res = await service.createInvoiceForAppointment('cl1', {
      patientId: 'p1',
      appointmentId: 'a1',
      amount: new Prisma.Decimal('100000'),
    });
    expect(res.id).toBe('existing');
    expect(create).not.toHaveBeenCalled();
  });
});
