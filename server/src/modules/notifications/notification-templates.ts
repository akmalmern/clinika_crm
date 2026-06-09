import { NotificationKind } from './constants/notification.constant';

/**
 * Xabar matni shablonlari (sof funksiyalar). MAXFIYLIK (spec 12): tibbiy tafsilot
 * (tashxis, natija, dori) YO'Q — faqat umumiy ma'lumot + ilovaga havola.
 */
export interface TemplateData {
  clinicName?: string;
  clinicPhone?: string | null;
  clinicAddress?: string | null;
  doctorName?: string | null;
  patientName?: string | null;
  when?: string; // mahalliy vaqt, oldindan formatlangan
  amount?: string;
  appLink?: string;
}

export function buildMessage(kind: string, d: TemplateData): string {
  const clinic = d.clinicName ?? 'Klinika';
  switch (kind) {
    case NotificationKind.APPOINTMENT_REMINDER:
      return (
        `Eslatma: ${d.when} da qabulingiz bor` +
        (d.doctorName ? `, shifokor ${d.doctorName}` : '') +
        `. ${clinic}` +
        (d.clinicAddress ? `, ${d.clinicAddress}` : '') +
        (d.clinicPhone ? `. Tel: ${d.clinicPhone}` : '') +
        '.'
      );
    case NotificationKind.APPOINTMENT_CONFIRM:
      return `Qabulingiz tasdiqlandi: ${d.when}${
        d.doctorName ? `, shifokor ${d.doctorName}` : ''
      }. ${clinic}.`;
    case NotificationKind.APPOINTMENT_CANCELLED:
      return (
        `Qabulingiz bekor qilindi: ${d.when}. ${clinic}` +
        (d.clinicPhone ? `. Tel: ${d.clinicPhone}` : '') +
        '.'
      );
    case NotificationKind.DOCTOR_NEW_APPOINTMENT:
      return `Yangi qabul: ${d.when}${
        d.patientName ? `, bemor ${d.patientName}` : ''
      }.`;
    case NotificationKind.DOCTOR_APPOINTMENT_CANCELLED:
      return `Qabul bekor qilindi: ${d.when}${
        d.patientName ? `, bemor ${d.patientName}` : ''
      }.`;
    case NotificationKind.DEBT_REMINDER:
      return (
        `Sizda ${d.amount} so'm qarz mavjud. ${clinic}` +
        (d.clinicPhone ? `. Tel: ${d.clinicPhone}` : '') +
        '.'
      );
    case NotificationKind.RESULT_READY:
      // MAXFIY: natija mazmuni YO'Q — faqat havola.
      return (
        `Natijangiz tayyor. Batafsil ko'rish uchun ilovaga kiring` +
        (d.appLink ? ` 👉 ${d.appLink}` : '') +
        `. ${clinic}.`
      );
    default:
      return `${clinic}: yangi bildirishnoma.`;
  }
}
