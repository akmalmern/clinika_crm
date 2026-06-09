/**
 * Fayl moduli konstantalari (Phase 4, spec 6). PostgreSQL enum EMAS (spec 1.6.A) —
 * string konstantalar + ilova darajasida validatsiya (yangi qiymat bazani buzmaydi).
 */

/** Fayl egasining turi (polimorfik owner_type). */
export const FileOwnerType = {
  USER: 'USER',
  PATIENT: 'PATIENT',
  CLINIC: 'CLINIC',
  MEDICAL_RECORD: 'MEDICAL_RECORD',
} as const;
export type FileOwnerType = (typeof FileOwnerType)[keyof typeof FileOwnerType];
export const ALL_OWNER_TYPES: string[] = Object.values(FileOwnerType);

/** Fayl toifasi (category). Xodim va bemor hujjatlari (spec 6.2). */
export const FileCategory = {
  // Umumiy / xodim
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  PASSPORT: 'PASSPORT',
  DIPLOMA: 'DIPLOMA',
  CERTIFICATE: 'CERTIFICATE',
  LICENSE: 'LICENSE',
  CONTRACT: 'CONTRACT',
  // Bemor
  PATIENT_PHOTO: 'PATIENT_PHOTO',
  PATIENT_PASSPORT: 'PATIENT_PASSPORT',
  MEDICAL_HISTORY: 'MEDICAL_HISTORY',
  LAB_RESULT: 'LAB_RESULT',
  XRAY_SCAN: 'XRAY_SCAN',
  REFERRAL: 'REFERRAL',
  // Boshqa
  OTHER: 'OTHER',
} as const;
export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];
export const ALL_FILE_CATEGORIES: string[] = Object.values(FileCategory);

/** Profil rasmi toifalari (avatar_url ni yangilash uchun). */
export const AVATAR_CATEGORIES: string[] = [
  FileCategory.PROFILE_PHOTO,
  FileCategory.PATIENT_PHOTO,
];

/** Owner turига mos profil rasm toifasi (staff -> PROFILE_PHOTO, bemor -> PATIENT_PHOTO). */
export function avatarCategoryFor(ownerType: string): string {
  return ownerType === FileOwnerType.PATIENT
    ? FileCategory.PATIENT_PHOTO
    : FileCategory.PROFILE_PHOTO;
}

/**
 * Ruxsat etilgan MIME turlari (spec 6.4 / 9): faqat jpg/png/pdf/docx.
 * Qiymat — kengaytmalar (xato xabarida ko'rsatish uchun).
 */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

export const ALLOWED_MIME_LIST: string[] = Object.keys(ALLOWED_MIME_TYPES);

/** Multer xotira himoya chegarasi (aniq limit servisda — config/tarif). */
export const MULTER_HARD_CAP = 100 * 1024 * 1024;

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mime);
}

export function extensionForMime(mime: string): string {
  return ALLOWED_MIME_TYPES[mime] ?? 'bin';
}
