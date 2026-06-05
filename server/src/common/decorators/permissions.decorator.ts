import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Endpoint uchun zarur ruxsatlar. PermissionsGuard tekshiradi.
 * Masalan: @Permissions(Permission.CLINIC_CREATE)
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
