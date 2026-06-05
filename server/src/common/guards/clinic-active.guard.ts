import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectPrisma } from '../../core/prisma/prisma.module';
import type { ExtendedPrismaClient } from '../../core/prisma/prisma-extensions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_SUSPENDED_KEY } from '../decorators/allow-suspended.decorator';
import { ActorType } from '../constants/roles.constant';
import { ClinicStatus } from '../constants/subscription.constant';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Suspend guard (spec 5.3): SUSPENDED klinika foydalanuvchilari uchun barcha
 * endpoint'lar bloklanadi — faqat @AllowSuspended bilan belgilanganlari (to'lov
 * sahifasi, billing holati, logout/profil) ochiq qoladi.
 *
 *  - SUPER_ADMIN bundan mustasno (har doim o'tadi).
 *  - Autentifikatsiyasiz/@Public route'lar bu guard'dan ta'sirlanmaydi.
 *
 * Bloklanganda 403 + `PAYMENT_REQUIRED` kodi qaytadi — frontend to'lov sahifasiga
 * yo'naltiradi.
 */
@Injectable()
export class ClinicActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectPrisma() private readonly prisma: ExtendedPrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const allowSuspended = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SUSPENDED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowSuspended) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    // Autentifikatsiyasiz yoki super admin -> guard ta'sir qilmaydi.
    if (!user || user.actorType !== ActorType.USER || !user.clinicId)
      return true;

    const clinic = await this.prisma.clinic.findFirst({
      where: { id: user.clinicId },
      select: { status: true },
    });

    if (!clinic || clinic.status === ClinicStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'PAYMENT_REQUIRED',
        message:
          "Klinika obunasi to'xtatilgan. Davom etish uchun to'lovni amalga oshiring.",
      });
    }

    return true;
  }
}
