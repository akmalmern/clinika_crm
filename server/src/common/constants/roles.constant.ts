/**
 * Rollar — PostgreSQL enum EMAS (spec 1.6.A), oddiy string konstantalar.
 * Yangi rol qo'shilsa baza o'zgarmaydi.
 */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CLINIC_ADMIN: 'CLINIC_ADMIN',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  NURSE: 'NURSE',
  CASHIER: 'CASHIER',
  PATIENT: 'PATIENT',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

/**
 * Klinika ichida xodimga biriktirilishi mumkin bo'lgan rollar
 * (SUPER_ADMIN va PATIENT bundan tashqarida).
 */
export const CLINIC_ROLES: string[] = [
  Role.CLINIC_ADMIN,
  Role.DOCTOR,
  Role.RECEPTIONIST,
  Role.NURSE,
  Role.CASHIER,
];

/**
 * Actor turi — token egasi platforma darajasidami (SUPER_ADMIN) yoki
 * klinika ichidagi foydalanuvchimi (USER). Tenant izolyatsiyasi shunga tayanadi.
 */
export const ActorType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];
