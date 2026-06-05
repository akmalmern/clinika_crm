import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { ActorType, Role } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

jest.mock('argon2');

const mockedVerify = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

describe('AuthService (Phase 1 — Super Admin)', () => {
  // Minimal mocklar — faqat ishlatiladigan metodlar.
  const prisma = {
    superAdmin: { findFirst: jest.fn() },
    clinic: { findFirst: jest.fn() },
    clinicMember: { findFirst: jest.fn() },
  };
  const tokenService = {
    issueTokens: jest.fn(),
    verifyRefresh: jest.fn(),
    revokeRefreshJti: jest.fn(),
    revokeAllUserRefresh: jest.fn(),
    blacklistAccess: jest.fn(),
  };
  const auditService = { log: jest.fn() };

  let service: AuthService;

  const admin = {
    id: '0192f3a0-0000-7000-8000-000000000001',
    fullName: 'Platform Owner',
    email: 'admin@clinic-crm.uz',
    passwordHash: 'hashed',
    isActive: true,
    deletedAt: null,
  };

  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      tokenService as never,
      auditService as never,
    );
    tokenService.issueTokens.mockResolvedValue(tokens);
  });

  describe('login', () => {
    it("to'g'ri parol bilan tokenlar qaytaradi va audit yozadi", async () => {
      prisma.superAdmin.findFirst.mockResolvedValue(admin);
      mockedVerify.mockResolvedValue(true);

      const result = await service.login({
        email: admin.email,
        password: 'Admin12345!',
      });

      expect(result.tokens).toEqual(tokens);
      expect(result.user).toMatchObject({
        id: admin.id,
        email: admin.email,
        actorType: ActorType.SUPER_ADMIN,
        role: Role.SUPER_ADMIN,
      });
      expect(tokenService.issueTokens).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN', entityId: admin.id }),
      );
    });

    it("noto'g'ri parolda 401 (UnauthorizedException)", async () => {
      prisma.superAdmin.findFirst.mockResolvedValue(admin);
      mockedVerify.mockResolvedValue(false);

      await expect(
        service.login({ email: admin.email, password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('admin topilmasa 401', async () => {
      prisma.superAdmin.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'yoq@x.uz', password: 'whatever12' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("hisob faol bo'lmasa 401", async () => {
      prisma.superAdmin.findFirst.mockResolvedValue({
        ...admin,
        isActive: false,
      });

      await expect(
        service.login({ email: admin.email, password: 'Admin12345!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('access tokenni blacklist qiladi va refreshlarni bekor qiladi', async () => {
      const user: AuthenticatedUser = {
        userId: admin.id,
        actorType: ActorType.SUPER_ADMIN,
        role: Role.SUPER_ADMIN,
        jti: 'access-jti',
      };

      await service.logout(user);

      expect(tokenService.blacklistAccess).toHaveBeenCalledWith('access-jti');
      expect(tokenService.revokeAllUserRefresh).toHaveBeenCalledWith(
        ActorType.SUPER_ADMIN,
        admin.id,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGOUT' }),
      );
    });
  });

  describe('clinic user login (clinicSlug bilan)', () => {
    const clinic = { id: 'clinic-A', slug: 'demo-klinika' };
    const member = {
      userId: 'user-1',
      role: Role.CLINIC_ADMIN,
      user: {
        id: 'user-1',
        fullName: 'Klinika Admin',
        email: 'admin@demo-klinika.uz',
        passwordHash: 'hashed',
        isActive: true,
      },
    };

    it("to'g'ri ma'lumotda USER token (clinicId bilan) qaytaradi", async () => {
      prisma.clinic.findFirst.mockResolvedValue(clinic);
      prisma.clinicMember.findFirst.mockResolvedValue(member);
      mockedVerify.mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@demo-klinika.uz',
        password: 'secret123',
        clinicSlug: 'demo-klinika',
      });

      expect(result.user.actorType).toBe(ActorType.USER);
      expect(result.user.clinicId).toBe('clinic-A');
      expect(result.user.role).toBe(Role.CLINIC_ADMIN);
      expect(tokenService.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: ActorType.USER,
          clinicId: 'clinic-A',
          role: Role.CLINIC_ADMIN,
        }),
      );
      // Super admin jadvaliga umuman murojaat qilmaydi
      expect(prisma.superAdmin.findFirst).not.toHaveBeenCalled();
    });

    it('klinika topilmasa 401', async () => {
      prisma.clinic.findFirst.mockResolvedValue(null);
      await expect(
        service.login({
          email: 'x@y.uz',
          password: 'secret123',
          clinicSlug: 'yoq',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("a'zo topilmasa 401", async () => {
      prisma.clinic.findFirst.mockResolvedValue(clinic);
      prisma.clinicMember.findFirst.mockResolvedValue(null);
      await expect(
        service.login({
          email: 'x@y.uz',
          password: 'secret123',
          clinicSlug: 'demo-klinika',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
