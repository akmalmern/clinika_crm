import { Role } from '@/types/auth';

/**
 * Frontend RBAC — backend `permissions.constant.ts` ROLE_PERMISSIONS bilan MOS.
 * Faqat UI'ni ko'rsatish/yashirish uchun (tugma, menyu). Haqiqiy tekshiruv har
 * doim backend'da (UI'ni chetlab o'tib bo'lmaydi).
 */
export const Permission = {
  STAFF_MANAGE: 'staff:manage',
  PATIENT_READ: 'patient:read',
  PATIENT_MANAGE: 'patient:manage',
  FILE_READ: 'file:read',
  FILE_MANAGE: 'file:manage',
  SERVICE_READ: 'service:read',
  SERVICE_MANAGE: 'service:manage',
  SCHEDULE_READ: 'schedule:read',
  SCHEDULE_MANAGE: 'schedule:manage',
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_MANAGE: 'appointment:manage',
  APPOINTMENT_STATUS: 'appointment:status',
  PATIENT_INVOICE_READ: 'patient_invoice:read',
  PATIENT_PAYMENT: 'patient_payment:manage',
  EMR_READ: 'emr:read',
  EMR_MANAGE: 'emr:manage',
  REPORT_READ: 'report:read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const P = Permission;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  [Role.CLINIC_ADMIN]: [
    P.STAFF_MANAGE,
    P.PATIENT_READ,
    P.PATIENT_MANAGE,
    P.FILE_READ,
    P.FILE_MANAGE,
    P.SERVICE_READ,
    P.SERVICE_MANAGE,
    P.SCHEDULE_READ,
    P.SCHEDULE_MANAGE,
    P.APPOINTMENT_READ,
    P.APPOINTMENT_MANAGE,
    P.APPOINTMENT_STATUS,
    P.PATIENT_INVOICE_READ,
    P.PATIENT_PAYMENT,
    P.EMR_READ,
    P.EMR_MANAGE,
    P.REPORT_READ,
  ],
  [Role.DOCTOR]: [
    P.PATIENT_READ,
    P.PATIENT_MANAGE,
    P.FILE_READ,
    P.FILE_MANAGE,
    P.SERVICE_READ,
    P.SCHEDULE_READ,
    P.APPOINTMENT_READ,
    P.APPOINTMENT_STATUS,
    P.PATIENT_INVOICE_READ,
    P.EMR_READ,
    P.EMR_MANAGE,
  ],
  [Role.RECEPTIONIST]: [
    P.PATIENT_READ,
    P.PATIENT_MANAGE,
    P.FILE_READ,
    P.FILE_MANAGE,
    P.SERVICE_READ,
    P.SCHEDULE_READ,
    P.APPOINTMENT_READ,
    P.APPOINTMENT_MANAGE,
    P.PATIENT_INVOICE_READ,
  ],
  [Role.NURSE]: [
    P.PATIENT_READ,
    P.FILE_READ,
    P.SERVICE_READ,
    P.SCHEDULE_READ,
    P.APPOINTMENT_READ,
    P.APPOINTMENT_STATUS,
    P.EMR_READ,
  ],
  [Role.CASHIER]: [
    P.PATIENT_READ,
    P.SERVICE_READ,
    P.APPOINTMENT_READ,
    P.PATIENT_INVOICE_READ,
    P.PATIENT_PAYMENT,
  ],
  [Role.SUPER_ADMIN]: ['*'],
};

export function hasPermission(
  role: string | undefined,
  permission: string,
): boolean {
  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return granted.includes('*') || granted.includes(permission);
}
