import { Role } from './roles.constant';

/**
 * Granular ruxsatlar (permission'lar). RBAC faqat rol nomiga emas,
 * aniq permission'larga tekshiradi (spec 4-bo'lim).
 *
 * Nomlash: `<resurs>:<amal>`. Phase'lar o'sgani sari kengaytiriladi.
 * Bu yerda — Phase 1/2 uchun zarur bo'lganlar.
 */
export const Permission = {
  // Platforma (super admin)
  CLINIC_CREATE: 'clinic:create',
  CLINIC_READ: 'clinic:read',
  CLINIC_UPDATE: 'clinic:update',
  CLINIC_DELETE: 'clinic:delete',
  PLAN_MANAGE: 'plan:manage',
  SUBSCRIPTION_MANAGE: 'subscription:manage',
  PLATFORM_STATS: 'platform:stats',
  // Billing (abonent to'lovi — platforma <-> klinika)
  BILLING_MANAGE: 'billing:manage', // invoice/manual to'lov/statistika (super admin)
  BILLING_READ: 'billing:read', // o'z klinikasi invoice'larini ko'rish (klinika admin)

  // Klinika ichidagi (keyingi phase'larda kengayadi)
  STAFF_MANAGE: 'staff:manage',
  PATIENT_READ: 'patient:read',
  PATIENT_MANAGE: 'patient:manage',
  AUDIT_READ: 'audit:read',
  // Fayllar (Phase 4)
  FILE_READ: 'file:read', // ro'yxat + signed URL (ko'rish/yuklab olish)
  FILE_MANAGE: 'file:manage', // yuklash + o'chirish
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Maxsus belgi: barcha ruxsatlarga ega (super admin).
 */
export const WILDCARD_PERMISSION = '*';

/**
 * Rol -> permission'lar xaritasi. Hozircha statik (kod ichida);
 * kelajakda DB'dan boshqariladigan dinamik RBAC'ga ko'chirish oson.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [Role.SUPER_ADMIN]: [WILDCARD_PERMISSION],
  [Role.CLINIC_ADMIN]: [
    Permission.STAFF_MANAGE,
    Permission.PATIENT_READ,
    Permission.PATIENT_MANAGE,
    Permission.AUDIT_READ,
    Permission.BILLING_READ,
    Permission.FILE_READ,
    Permission.FILE_MANAGE,
  ],
  [Role.DOCTOR]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_MANAGE,
    Permission.FILE_READ,
    Permission.FILE_MANAGE,
  ],
  [Role.RECEPTIONIST]: [
    Permission.PATIENT_READ,
    Permission.PATIENT_MANAGE,
    Permission.FILE_READ,
    Permission.FILE_MANAGE,
  ],
  [Role.NURSE]: [Permission.PATIENT_READ, Permission.FILE_READ],
  [Role.CASHIER]: [Permission.PATIENT_READ],
  [Role.PATIENT]: [],
};

/**
 * Berilgan rol uchun ruxsatlar to'plamini qaytaradi.
 */
export function permissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Rol talab qilingan ruxsatlarning HAMMASIga egami?
 */
export function roleHasPermissions(role: string, required: string[]): boolean {
  if (required.length === 0) return true;
  const granted = permissionsForRole(role);
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  return required.every((p) => granted.includes(p));
}
