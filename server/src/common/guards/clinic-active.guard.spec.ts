import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicActiveGuard } from './clinic-active.guard';
import { ALLOW_SUSPENDED_KEY } from '../decorators/allow-suspended.decorator';
import { ActorType } from '../constants/roles.constant';
import { AuthenticatedUser } from '../types/authenticated-user';

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const clinicUser: AuthenticatedUser = {
  userId: 'u1',
  actorType: ActorType.USER,
  role: 'CLINIC_ADMIN',
  clinicId: 'clinic-A',
};

const superAdmin: AuthenticatedUser = {
  userId: 's1',
  actorType: ActorType.SUPER_ADMIN,
  role: 'SUPER_ADMIN',
};

describe('ClinicActiveGuard (suspend)', () => {
  const prisma = { clinic: { findFirst: jest.fn() } };

  function makeGuard(allowSuspended = false): ClinicActiveGuard {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ALLOW_SUSPENDED_KEY ? allowSuspended : false,
      ),
    } as unknown as Reflector;
    return new ClinicActiveGuard(reflector, prisma as never);
  }

  beforeEach(() => jest.clearAllMocks());

  it('SUSPENDED klinika foydalanuvchisini bloklaydi (PAYMENT_REQUIRED)', async () => {
    prisma.clinic.findFirst.mockResolvedValue({ status: 'SUSPENDED' });
    const guard = makeGuard();

    await expect(
      guard.canActivate(makeContext(clinicUser)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Kod PAYMENT_REQUIRED ekanini tekshiramiz
    try {
      await guard.canActivate(makeContext(clinicUser));
      fail('xato kutilgan edi');
    } catch (e) {
      const res = (e as ForbiddenException).getResponse() as { code?: string };
      expect(res.code).toBe('PAYMENT_REQUIRED');
    }
  });

  it("ACTIVE klinika foydalanuvchisini o'tkazadi", async () => {
    prisma.clinic.findFirst.mockResolvedValue({ status: 'ACTIVE' });
    const guard = makeGuard();
    await expect(guard.canActivate(makeContext(clinicUser))).resolves.toBe(
      true,
    );
  });

  it("super admin har doim o'tadi (DB so'rovisiz)", async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(makeContext(superAdmin))).resolves.toBe(
      true,
    );
    expect(prisma.clinic.findFirst).not.toHaveBeenCalled();
  });

  it("@AllowSuspended bo'lsa SUSPENDED bo'lsa ham o'tadi", async () => {
    const guard = makeGuard(true);
    await expect(guard.canActivate(makeContext(clinicUser))).resolves.toBe(
      true,
    );
    expect(prisma.clinic.findFirst).not.toHaveBeenCalled();
  });

  it("autentifikatsiyasiz (user yo'q) o'tadi", async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
  });
});
