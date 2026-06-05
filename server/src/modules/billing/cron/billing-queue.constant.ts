/** BullMQ billing navbati nomi va job nomlari (spec 5.3 — cron). */
export const BILLING_QUEUE = 'billing';

export const BillingJob = {
  /** Har kuni: invoice yaratish + grace o'tganni SUSPENDED qilish. */
  DAILY: 'daily-billing',
} as const;

/** Repeatable job uchun barqaror jobId (qayta ro'yxatga olishda dublь bo'lmaydi). */
export const BILLING_DAILY_JOB_ID = 'billing:daily';

/** Cron ifodasi (UTC) — har kuni 02:00. Env orqali ham boshqarsa bo'ladi. */
export const BILLING_DAILY_CRON = process.env.BILLING_CRON ?? '0 2 * * *';
