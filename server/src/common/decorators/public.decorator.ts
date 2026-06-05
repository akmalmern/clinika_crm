import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Endpoint'ni autentifikatsiyasiz ochiq qiladi (global JwtAuthGuard'ni chetlab o'tadi).
 * Masalan: login, refresh, health.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
