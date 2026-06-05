import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Endpoint'ga kira oladigan rollar. RolesGuard tekshiradi.
 * Masalan: @Roles(Role.SUPER_ADMIN)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
