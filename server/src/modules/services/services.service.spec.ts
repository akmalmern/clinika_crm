import { Prisma } from '@prisma/client';
import { ServicesService } from './services.service';

/**
 * ServicesService (DB'siz, mock). DoD: narx o'zgarsa service_price_history'ga
 * yoziladi (kim/qachon/eski->yangi); o'zgarmasa yozilmaydi.
 */
describe('ServicesService', () => {
  function makeService(opts: {
    service: Record<string, unknown>;
    tx: Record<string, unknown>;
  }) {
    const prisma = {
      service: {
        findFirst: jest.fn().mockResolvedValue(opts.service),
      },
      $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) =>
        cb(opts.tx),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ServicesService(prisma as never, audit as never);
    return { service, prisma, audit };
  }

  const existing = {
    id: 'svc1',
    clinicId: 'cl1',
    name: 'Qon tahlili',
    price: new Prisma.Decimal('50000'),
    currency: 'UZS',
    categoryId: null,
    duration: 30,
    isActive: true,
    createdAt: new Date(),
  };

  it("narx o'zgarsa -> service_price_history'ga yoziladi", async () => {
    const tx = {
      servicePriceHistory: { create: jest.fn().mockResolvedValue({}) },
      service: {
        update: jest.fn().mockResolvedValue({
          ...existing,
          price: new Prisma.Decimal('60000'),
        }),
      },
    };
    const { service, audit } = makeService({ service: existing, tx });

    const res = await service.update('cl1', 'svc1', { price: '60000' }, 'u1');

    expect(tx.servicePriceHistory.create).toHaveBeenCalledTimes(1);
    const histData = tx.servicePriceHistory.create.mock.calls[0][0].data;
    expect(histData.oldPrice.toString()).toBe('50000');
    expect(histData.newPrice.toString()).toBe('60000');
    expect(histData.changedBy).toBe('u1');
    expect(res.price).toBe('60000');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SERVICE_PRICE_CHANGE' }),
    );
  });

  it("narx o'zgarmasa (bir xil) -> tarix yozilmaydi", async () => {
    const tx = {
      servicePriceHistory: { create: jest.fn() },
      service: { update: jest.fn().mockResolvedValue(existing) },
    };
    const { service } = makeService({ service: existing, tx });

    await service.update('cl1', 'svc1', { price: '50000' }, 'u1');
    expect(tx.servicePriceHistory.create).not.toHaveBeenCalled();
  });

  it('narx berilmasa (faqat boshqa maydon) -> tarix yozilmaydi', async () => {
    const tx = {
      servicePriceHistory: { create: jest.fn() },
      service: {
        update: jest.fn().mockResolvedValue({ ...existing, duration: 45 }),
      },
    };
    const { service } = makeService({ service: existing, tx });

    await service.update('cl1', 'svc1', { duration: 45 }, 'u1');
    expect(tx.servicePriceHistory.create).not.toHaveBeenCalled();
  });
});
