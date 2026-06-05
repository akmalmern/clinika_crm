import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { roleHasPermissions } from '../constants/permissions.constant';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * @Permissions(...) tekshiruvi — rol nomiga emas, aniq ruxsatlarga qarab.
 * Super admin (ROLE_PERMISSIONS'da '*') hammasiga ruxsatli.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !roleHasPermissions(user.role, required)) {
      throw new ForbiddenException(
        "Bu amal uchun yetarli ruxsat (permission) yo'q",
      );
    }
    return true;
  }
}
