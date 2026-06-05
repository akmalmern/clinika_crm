import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUSPENDED_KEY = 'allowSuspended';

/**
 * Endpoint'ni SUSPENDED (to'lov qilinmagan) klinika foydalanuvchilariga ham
 * ochiq qoldiradi. Masalan: to'lov sahifasi, billing holati, logout, profil.
 * ClinicActiveGuard shu belgini hurmat qiladi.
 */
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);
