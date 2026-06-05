import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { ActorType, Role } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { IssuedTokens, TokenService } from './token.service';

export interface AuthProfile {
  id: string;
  fullName: string;
  email: string | null;
  actorType: string;
  role: string;
  clinicId?: string;
  clinicSlug?: string;
}

export interface LoginResult {
  user: AuthProfile;
  tokens: IssuedTokens;
}

/**
 * Autentifikatsiya servisi.
 *
 * Ikki xil aktör:
 *  - SUPER_ADMIN: `super_admins` jadvali, login email+parol (clinicSlug'siz).
 *  - USER (klinika xodimi): `users` + `clinic_members`, login email+parol+clinicSlug.
 *    Bir email bir nechta klinikada bo'lishi mumkin, shuning uchun klinika kerak.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    return dto.clinicSlug
      ? this.loginClinicUser(dto, dto.clinicSlug)
      : this.loginSuperAdmin(dto);
  }

  private async loginSuperAdmin(dto: LoginDto): Promise<LoginResult> {
    // Partial unique tufayli findFirst (findUnique emas).
    const admin = await this.prisma.superAdmin.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (
      !admin ||
      !admin.isActive ||
      !(await argon2.verify(admin.passwordHash, dto.password))
    ) {
      // Foydalanuvchi sanab chiqishning oldini olish uchun umumiy xato.
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    const tokens = await this.tokenService.issueTokens({
      sub: admin.id,
      actorType: ActorType.SUPER_ADMIN,
      role: Role.SUPER_ADMIN,
      email: admin.email,
    });

    await this.auditService.log({
      action: 'AUTH_LOGIN',
      entity: 'SuperAdmin',
      entityId: admin.id,
      userId: admin.id,
      actorType: ActorType.SUPER_ADMIN,
    });

    return {
      user: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        actorType: ActorType.SUPER_ADMIN,
        role: Role.SUPER_ADMIN,
      },
      tokens,
    };
  }

  private async loginClinicUser(
    dto: LoginDto,
    clinicSlug: string,
  ): Promise<LoginResult> {
    const invalid = (): never => {
      throw new UnauthorizedException("Email, parol yoki klinika noto'g'ri");
    };

    const clinic = await this.prisma.clinic.findFirst({
      where: { slug: clinicSlug, deletedAt: null },
    });
    if (!clinic) invalid();

    // clinic_members orqali: shu klinikadagi, shu emailli, faol a'zo.
    const member = await this.prisma.clinicMember.findFirst({
      where: {
        clinicId: clinic!.id,
        isActive: true,
        deletedAt: null,
        user: { email: dto.email, isActive: true, deletedAt: null },
      },
      include: { user: true },
    });

    if (
      !member ||
      !(await argon2.verify(member.user.passwordHash, dto.password))
    ) {
      invalid();
    }

    const tokens = await this.tokenService.issueTokens({
      sub: member!.userId,
      actorType: ActorType.USER,
      role: member!.role,
      email: member!.user.email ?? undefined,
      clinicId: clinic!.id,
    });

    await this.auditService.log({
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: member!.userId,
      userId: member!.userId,
      clinicId: clinic!.id,
      actorType: ActorType.USER,
    });

    return {
      user: {
        id: member!.userId,
        fullName: member!.user.fullName,
        email: member!.user.email,
        actorType: ActorType.USER,
        role: member!.role,
        clinicId: clinic!.id,
        clinicSlug: clinic!.slug,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const payload = await this.tokenService.verifyRefresh(refreshToken);

    if (payload.actorType === ActorType.SUPER_ADMIN) {
      const admin = await this.prisma.superAdmin.findFirst({
        where: { id: payload.sub, deletedAt: null },
      });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Hisob faol emas');
      }
      await this.tokenService.revokeRefreshJti(
        payload.actorType,
        payload.sub,
        payload.jti,
      );
      return this.tokenService.issueTokens({
        sub: admin.id,
        actorType: ActorType.SUPER_ADMIN,
        role: Role.SUPER_ADMIN,
        email: admin.email,
      });
    }

    // USER (klinika xodimi)
    if (!payload.clinicId) {
      throw new UnauthorizedException("Refresh token tarkibi noto'g'ri");
    }
    const member = await this.prisma.clinicMember.findFirst({
      where: {
        userId: payload.sub,
        clinicId: payload.clinicId,
        isActive: true,
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      include: { user: true },
    });
    if (!member) {
      throw new UnauthorizedException("A'zolik faol emas");
    }
    await this.tokenService.revokeRefreshJti(
      payload.actorType,
      payload.sub,
      payload.jti,
    );
    return this.tokenService.issueTokens({
      sub: member.userId,
      actorType: ActorType.USER,
      role: member.role,
      email: member.user.email ?? undefined,
      clinicId: payload.clinicId,
    });
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    if (user.jti) {
      await this.tokenService.blacklistAccess(user.jti);
    }
    await this.tokenService.revokeAllUserRefresh(user.actorType, user.userId);

    await this.auditService.log({
      action: 'AUTH_LOGOUT',
      entity: user.actorType === ActorType.SUPER_ADMIN ? 'SuperAdmin' : 'User',
      entityId: user.userId,
      userId: user.userId,
      clinicId: user.clinicId,
      actorType: user.actorType,
    });
  }

  async getProfile(user: AuthenticatedUser): Promise<AuthProfile> {
    if (user.actorType === ActorType.SUPER_ADMIN) {
      const admin = await this.prisma.superAdmin.findFirst({
        where: { id: user.userId, deletedAt: null },
      });
      if (!admin) throw new UnauthorizedException('Hisob topilmadi');
      return {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        actorType: ActorType.SUPER_ADMIN,
        role: Role.SUPER_ADMIN,
      };
    }

    // USER — joriy klinika a'zoligi (tenant konteksti clinicId ni biladi).
    const member = await this.prisma.clinicMember.findFirst({
      where: { userId: user.userId, clinicId: user.clinicId, deletedAt: null },
      include: { user: true, clinic: true },
    });
    if (!member) throw new UnauthorizedException("A'zolik topilmadi");
    return {
      id: member.userId,
      fullName: member.user.fullName,
      email: member.user.email,
      actorType: ActorType.USER,
      role: member.role,
      clinicId: member.clinicId,
      clinicSlug: member.clinic.slug,
    };
  }
}
