import * as argon2 from 'argon2';
import { ClinicsService } from './clinics.service';

jest.mock('argon2');

const mockedHash = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

describe('ClinicsService.create', () => {
  const tx = {
    clinic: {
      create: jest.fn().mockResolvedValue({
        id: 'c1',
        name: 'Demo Klinika',
        slug: 'demo-klinika',
        status: 'TRIAL',
        address: null,
        phone: null,
        email: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    user: {
      create: jest.fn().mockResolvedValue({
        id: 'u1',
        fullName: 'Admin',
        email: 'admin@demo.uz',
        phone: null,
      }),
    },
    clinicMember: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
    subscription: {
      create: jest.fn().mockResolvedValue({
        id: 'sub1',
        clinicId: 'c1',
        status: 'TRIAL',
        startDate: new Date(),
        endDate: new Date(),
        nextBillingDate: new Date(),
        graceUntil: null,
        plan: {
          id: 'plan-basic',
          name: 'BASIC',
          price: '199000.00',
          billingCycle: 'MONTHLY',
        },
      }),
    },
  };

  const prisma = {
    subscriptionPlan: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'plan-basic',
        name: 'BASIC',
        billingCycle: 'MONTHLY',
      }),
    },
    clinic: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  const audit = { log: jest.fn() };
  const config = {
    getOrThrow: jest
      .fn()
      .mockReturnValue({ trialDays: 14, defaultCurrency: 'UZS' }),
  };

  let service: ClinicsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHash.mockResolvedValue('hashed');
    prisma.clinic.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan-basic',
      name: 'BASIC',
      billingCycle: 'MONTHLY',
    });
    service = new ClinicsService(
      prisma as never,
      audit as never,
      config as never,
    );
  });

  it('klinika + CLINIC_ADMIN + obuna yaratadi, parol generatsiya qaytaradi', async () => {
    const result = await service.create({
      name: 'Demo Klinika',
      adminFullName: 'Admin',
      adminEmail: 'admin@demo.uz',
    });

    expect(result.clinic.id).toBe('c1');
    expect(result.admin.role).toBe('CLINIC_ADMIN');
    expect(result.admin.temporaryPassword).toBeDefined();
    expect(result.admin.temporaryPassword!.length).toBeGreaterThanOrEqual(12);
    expect(result.subscription.plan?.name).toBe('BASIC');

    // Parol xeshlanib saqlandi (ochiq emas)
    expect(mockedHash).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed' }),
      }),
    );
    // CLINIC_ADMIN a'zoligi
    expect(tx.clinicMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'CLINIC_ADMIN' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CLINIC_CREATE' }),
    );
  });

  it('admin paroli berilsa temporaryPassword qaytarmaydi', async () => {
    const result = await service.create({
      name: 'Demo 2',
      adminFullName: 'Admin',
      adminEmail: 'a2@demo.uz',
      adminPassword: 'MyStrongPass1',
    });
    expect(result.admin.temporaryPassword).toBeUndefined();
  });
});
