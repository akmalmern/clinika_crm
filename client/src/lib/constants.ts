/**
 * Frontend konstantalari — backend enum'lariga mos (DB enum EMAS). Faqat
 * ko'rsatish/validatsiya uchun; haqiqiy tekshiruv backend'da.
 */

// ---- Jins ----
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export const GENDER_LABEL: Record<string, string> = {
  MALE: 'Erkak',
  FEMALE: 'Ayol',
  OTHER: 'Boshqa',
};

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ---- Klinika rollari (xodim formasi) ----
export const CLINIC_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'CLINIC_ADMIN', label: 'Klinika administratori' },
  { value: 'DOCTOR', label: 'Shifokor' },
  { value: 'RECEPTIONIST', label: 'Registrator' },
  { value: 'NURSE', label: 'Hamshira' },
  { value: 'CASHIER', label: 'Kassir' },
];

// ---- Fayl toifalari ----
export const FILE_CATEGORY_LABEL: Record<string, string> = {
  PROFILE_PHOTO: 'Profil rasmi',
  PASSPORT: 'Pasport',
  DIPLOMA: 'Diplom',
  CERTIFICATE: 'Sertifikat',
  LICENSE: 'Litsenziya',
  CONTRACT: 'Shartnoma',
  PATIENT_PHOTO: 'Bemor rasmi',
  PATIENT_PASSPORT: 'Pasport',
  MEDICAL_HISTORY: 'Kasallik tarixi',
  LAB_RESULT: 'Tahlil natijasi',
  XRAY_SCAN: 'Rentgen/skan',
  REFERRAL: 'Yo`llanma',
  OTHER: 'Boshqa',
};

export const STAFF_DOC_CATEGORIES = [
  'PASSPORT',
  'DIPLOMA',
  'CERTIFICATE',
  'LICENSE',
  'CONTRACT',
  'OTHER',
];

export const PATIENT_DOC_CATEGORIES = [
  'PATIENT_PASSPORT',
  'MEDICAL_HISTORY',
  'LAB_RESULT',
  'XRAY_SCAN',
  'REFERRAL',
  'OTHER',
];

export const EMR_FILE_CATEGORIES = [
  'LAB_RESULT',
  'XRAY_SCAN',
  'MEDICAL_HISTORY',
  'REFERRAL',
  'OTHER',
];

// ---- Qabul holatlari ----
export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  ARRIVED: 'Keldi',
  IN_PROGRESS: 'Qabulda',
  COMPLETED: 'Yakunlandi',
  CANCELLED: 'Bekor qilindi',
  NO_SHOW: 'Kelmadi',
};

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'outline';

export const APPOINTMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'secondary',
  ARRIVED: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
};

/** Ruxsat etilgan holat o'tishlari (backend STATUS_TRANSITIONS bilan mos). */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ---- Kassa ----
export const PAYMENT_METHODS = ['CASH', 'CARD', 'PAYME', 'CLICK'] as const;
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  PAYME: 'Payme',
  CLICK: 'Click',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIAL: 'Qisman',
  PAID: "To'langan",
  CANCELLED: 'Bekor',
};
export const INVOICE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  UNPAID: 'destructive',
  PARTIAL: 'warning',
  PAID: 'success',
  CANCELLED: 'secondary',
};

// ---- Hafta kunlari (0=Yakshanba .. 6=Shanba) ----
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Dushanba', short: 'Du' },
  { value: 2, label: 'Seshanba', short: 'Se' },
  { value: 3, label: 'Chorshanba', short: 'Ch' },
  { value: 4, label: 'Payshanba', short: 'Pa' },
  { value: 5, label: 'Juma', short: 'Ju' },
  { value: 6, label: 'Shanba', short: 'Sh' },
  { value: 0, label: 'Yakshanba', short: 'Ya' },
];

// ---- Fayl yuklash (dropzone accept) ----
export const ACCEPTED_FILE_TYPES =
  '.jpg,.jpeg,.png,.pdf,.docx,image/jpeg,image/png,application/pdf';
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png';

// ---- Super Admin: klinika holatlari ----
export const CLINIC_STATUSES = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'];
export const CLINIC_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Sinov',
  SUSPENDED: "To'xtatilgan",
  CANCELLED: 'Bekor qilingan',
};
export const CLINIC_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  TRIAL: 'secondary',
  SUSPENDED: 'destructive',
  CANCELLED: 'outline',
};

// ---- Obuna holatlari ----
export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Sinov',
  PAST_DUE: "Muddati o'tgan",
  SUSPENDED: "To'xtatilgan",
  CANCELLED: 'Bekor qilingan',
};
export const SUBSCRIPTION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  TRIAL: 'secondary',
  PAST_DUE: 'warning',
  SUSPENDED: 'destructive',
  CANCELLED: 'outline',
};

// ---- Tarif sikllari ----
export const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const;
export const BILLING_CYCLE_LABEL: Record<string, string> = {
  MONTHLY: 'Oylik',
  YEARLY: 'Yillik',
};

// ---- Abonent invoice holatlari ----
export const ADMIN_INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "To'lanmagan",
  PARTIAL: 'Qisman',
  PAID: "To'langan",
  OVERDUE: "Muddati o'tgan",
  CANCELLED: 'Bekor',
};
export const ADMIN_INVOICE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  UNPAID: 'destructive',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'destructive',
  CANCELLED: 'outline',
};

// ---- MANUAL to'lov usullari (super admin) ----
export const MANUAL_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD'] as const;
export const MANUAL_METHOD_LABEL: Record<string, string> = {
  CASH: 'Naqd',
  BANK_TRANSFER: "Bank o'tkazmasi",
  CARD: 'Karta',
};

// ---- To'lov provayderlari ----
export const PROVIDER_LABEL: Record<string, string> = {
  PAYME: 'Payme',
  CLICK: 'Click',
  MANUAL: "Qo'lda",
};
