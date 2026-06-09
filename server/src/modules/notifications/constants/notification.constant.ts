/** Bildirishnoma konstantalari (Phase 7A). */

export const NOTIFICATIONS_QUEUE = 'notifications';

/** Yuborish kanali. */
export const NotificationChannel = {
  SMS: 'SMS',
  TELEGRAM: 'TELEGRAM',
  BOTH: 'BOTH',
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

/** Xabar turi. Tibbiy tafsilot YO'Q — faqat umumiy + havola (spec 12). */
export const NotificationKind = {
  APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER', // bemorga qabul eslatmasi
  APPOINTMENT_CONFIRM: 'APPOINTMENT_CONFIRM', // bemorga tasdiq
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED', // bemorga bekor
  DOCTOR_NEW_APPOINTMENT: 'DOCTOR_NEW_APPOINTMENT', // shifokorga yangi qabul
  DOCTOR_APPOINTMENT_CANCELLED: 'DOCTOR_APPOINTMENT_CANCELLED',
  DEBT_REMINDER: 'DEBT_REMINDER', // bemorga qarz eslatmasi
  RESULT_READY: 'RESULT_READY', // "natija tayyor, ilovaga kiring"
} as const;
export type NotificationKind =
  (typeof NotificationKind)[keyof typeof NotificationKind];

/** Bildirishnoma egasi turi (telegram_links owner_type bilan mos). */
export const NotificationOwnerType = {
  PATIENT: 'PATIENT',
  USER: 'USER',
} as const;

export const TelegramLinkStatus = {
  PENDING: 'PENDING',
  LINKED: 'LINKED',
} as const;

/** Navbatdagi bitta bildirishnoma topshirig'i. */
export interface NotificationJob {
  clinicId: string;
  kind: string;
  /** Asosiy obyekt id (appointmentId / patientInvoiceId / patientId). */
  refId: string;
  channel?: string; // default BOTH
}
