import { ConflictException } from '@nestjs/common';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  const prisma = {
    subscriptionPlan: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: PlansService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlansService(prisma as never);
  });

  it('yangi tarif yaratadi (Decimal narx string sifatida qaytadi)', async () => {
    prisma.subscriptionPlan.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.create.mockResolvedValue({
      id: 'p1',
      name: 'BASIC',
      price: '199000.00',
      currency: 'UZS',
      billingCycle: 'MONTHLY',
      limits: { maxStaff: 5 },
      features: { pharmacy: false },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await service.create({
      name: 'BASIC',
      price: '199000.00',
      billingCycle: 'MONTHLY',
    });

    expect(res.name).toBe('BASIC');
    expect(res.price).toBe('199000.00');
    expect(typeof res.price).toBe('string');
  });

  it('takroriy nom uchun ConflictException', async () => {
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'existing',
      name: 'BASIC',
    });

    await expect(
      service.create({
        name: 'BASIC',
        price: '100000',
        billingCycle: 'MONTHLY',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.subscriptionPlan.create).not.toHaveBeenCalled();
  });
});
