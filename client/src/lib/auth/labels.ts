import { Role } from '@/types/auth';

/** Rol -> foydalanuvchiga ko'rinadigan o'zbekcha nom (i18n keyinroq kengayadi). */
export const ROLE_LABEL: Record<string, string> = {
  [Role.SUPER_ADMIN]: 'Super admin',
  [Role.CLINIC_ADMIN]: 'Klinika administratori',
  [Role.DOCTOR]: 'Shifokor',
  [Role.RECEPTIONIST]: 'Registrator',
  [Role.NURSE]: 'Hamshira',
  [Role.CASHIER]: 'Kassir',
  [Role.PATIENT]: 'Bemor',
};

export function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABEL[role] ?? role;
}
