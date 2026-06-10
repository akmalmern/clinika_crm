/** Klinika CRM rollari (backend `roles.constant.ts` bilan mos). */
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

/** Klinika ichidagi rollar (SUPER_ADMIN bundan tashqarida). */
export const CLINIC_ROLES: Role[] = [
  Role.CLINIC_ADMIN,
  Role.DOCTOR,
  Role.RECEPTIONIST,
  Role.NURSE,
  Role.CASHIER,
];

/** Backend `/auth/me` profili. */
export interface AuthProfile {
  id: string;
  fullName: string;
  email: string | null;
  actorType: string;
  role: Role;
  clinicId?: string;
  clinicSlug?: string;
}

/** Backend `/auth/login` natijasidagi tokenlar. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn: number;
}

export interface LoginResult {
  user: AuthProfile;
  tokens: IssuedTokens;
}
