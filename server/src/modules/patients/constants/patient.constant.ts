/** Bemor konstantalari — DB enum EMAS (spec 1.6.A), string + validatsiya. */
export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const ALL_GENDERS: string[] = Object.values(Gender);

/** Qon guruhlari (ixtiyoriy maydon validatsiyasi uchun). */
export const BLOOD_TYPES: string[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];
