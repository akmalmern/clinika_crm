import { CLINIC_ROLES, Role } from '@/types/auth';

/**
 * Rol -> bosh sahifa (login'dan keyin / noto'g'ri panelga kirganda yo'naltirish).
 * Pure modul (React/icon yo'q) — middleware (edge) ham import qila oladi.
 */
export const ROLE_HOME: Record<string, string> = {
  [Role.SUPER_ADMIN]: '/super-admin/dashboard',
  [Role.CLINIC_ADMIN]: '/clinic/dashboard',
  [Role.DOCTOR]: '/clinic/dashboard',
  [Role.RECEPTIONIST]: '/clinic/dashboard',
  [Role.NURSE]: '/clinic/dashboard',
  [Role.CASHIER]: '/clinic/dashboard',
};

/** Noma'lum rol uchun zaxira yo'l. */
export const FALLBACK_HOME = '/login';

export function homeForRole(role: string | undefined): string {
  if (!role) return FALLBACK_HOME;
  return ROLE_HOME[role] ?? FALLBACK_HOME;
}

export function isSuperAdmin(role: string | undefined): boolean {
  return role === Role.SUPER_ADMIN;
}

export function isClinicRole(role: string | undefined): boolean {
  return !!role && (CLINIC_ROLES as string[]).includes(role);
}

/** Berilgan rol shu URL-segment paneliga kirishga haqlimi? */
export function canAccessPanel(
  role: string | undefined,
  panel: 'super-admin' | 'clinic',
): boolean {
  if (panel === 'super-admin') return isSuperAdmin(role);
  return isClinicRole(role);
}
