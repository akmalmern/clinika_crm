/**
 * Hisobot (Reports & Analytics, Phase 7B) konstantalari — DB enum EMAS,
 * string + ilova darajasida validatsiya (spec 1.6.A).
 */

/** Vaqt bo'yicha guruhlash (kun/hafta/oy). */
export const ReportGroupBy = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
} as const;
export type ReportGroupBy = (typeof ReportGroupBy)[keyof typeof ReportGroupBy];
export const ALL_REPORT_GROUP_BY: string[] = Object.values(ReportGroupBy);

/**
 * date_trunc uchun ruxsat etilgan birliklar (WHITELIST). FAQAT shu qiymatlar
 * SQL'ga inline qilinadi (SQL-injection xavfsizligi — foydalanuvchi matni emas).
 */
export const TRUNC_UNIT: Record<string, 'day' | 'week' | 'month'> = {
  [ReportGroupBy.DAY]: 'day',
  [ReportGroupBy.WEEK]: 'week',
  [ReportGroupBy.MONTH]: 'month',
};

/** Eksport formati. */
export const ExportFormat = {
  CSV: 'csv',
  PDF: 'pdf',
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
export const ALL_EXPORT_FORMATS: string[] = Object.values(ExportFormat);

/** Redis kesh kalit prefiksi (cache-aside, spec 1.7.G). */
export const REPORT_CACHE_PREFIX = 'report';

/** Standart sana oralig'i (kun) — from/to berilmasa oxirgi shuncha kun. */
export const DEFAULT_RANGE_DAYS = 30;

/** Obuna muddati "yaqinda tugaydi" oynasi (kun) — platforma hisoboti. */
export const DEFAULT_EXPIRING_DAYS = 7;
