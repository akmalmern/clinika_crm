/**
 * Billing (Phase 3) konstantalari — PostgreSQL enum EMAS (spec 1.6.A),
 * string/number konstantalar + ilova darajasida validatsiya.
 */

/** Invoice holati. debt_amount > 0 bo'lsa UNPAID/PARTIAL; 0 bo'lsa PAID. */
export const InvoiceStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

/** Tranzaksiya holati (bizning ichki ledger holati). */
export const TransactionStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

/** To'lov provayderi. */
export const PaymentProvider = {
  PAYME: 'PAYME',
  CLICK: 'CLICK',
  MANUAL: 'MANUAL',
} as const;
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** To'lov usuli (asosan MANUAL uchun; provayderlarda ONLINE). */
export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  ONLINE: 'ONLINE',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const MANUAL_METHODS: string[] = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CARD,
];

// ===========================================================================
// PAYME (Merchant API — JSON-RPC 2.0). Rasmiy spetsifikatsiyaga mos kodlar.
// ===========================================================================

/** Payme tranzaksiya holatlari (state). */
export const PaymeState = {
  CREATED: 1, // yaratildi, to'lov kutilmoqda
  PERFORMED: 2, // muvaffaqiyatli yakunlandi (to'landi)
  CANCELLED: -1, // yaratilgandan keyin bekor qilindi
  CANCELLED_AFTER_PERFORM: -2, // yakunlangandan keyin bekor qilindi (qaytarish)
} as const;

/** Payme JSON-RPC error kodlari (rasmiy). */
export const PaymeError = {
  // -32700..-32600 — transport/format
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  // Avtorizatsiya (Basic auth muvaffaqiyatsiz)
  INSUFFICIENT_PRIVILEGE: -32504,
  // Biznes xatolar
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANT_PERFORM: -31008, // holatga ko'ra bajarib bo'lmaydi (timeout/holat)
  CANT_CANCEL: -31007, // bekor qilib bo'lmaydi (yakunlangan xizmat)
  // Account (order) xatolari — -31099..-31050 oralig'i merchant ixtiyorida
  ACCOUNT_NOT_FOUND: -31050, // invoice topilmadi
  ACCOUNT_ALREADY_PAID: -31051, // invoice allaqachon to'langan/yopilgan
} as const;

/** Payme tranzaksiya yaroqlilik muddati (ms) — 12 soat. */
export const PAYME_TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/** Payme Basic auth login (har doim "Paycom"). */
export const PAYME_AUTH_LOGIN = 'Paycom';

/**
 * Payme account maydoni xatosi uchun ko'p tilli xabar (spec: i18n boshidan).
 * Payme `error.message` obyekt sifatida {ru, uz, en} kutadi.
 */
export interface PaymeLocalizedMessage {
  ru: string;
  uz: string;
  en: string;
}

export const PAYME_MESSAGES: Record<string, PaymeLocalizedMessage> = {
  ACCOUNT_NOT_FOUND: {
    ru: 'Счёт (инвойс) не найден',
    uz: 'Hisob-faktura topilmadi',
    en: 'Invoice not found',
  },
  ACCOUNT_ALREADY_PAID: {
    ru: 'Счёт уже оплачен',
    uz: "Hisob-faktura allaqachon to'langan",
    en: 'Invoice already paid',
  },
  INVALID_AMOUNT: {
    ru: 'Неверная сумма',
    uz: "Noto'g'ri summa",
    en: 'Invalid amount',
  },
  CANT_PERFORM: {
    ru: 'Невозможно выполнить операцию',
    uz: "Operatsiyani bajarib bo'lmaydi",
    en: 'Unable to perform operation',
  },
  TRANSACTION_NOT_FOUND: {
    ru: 'Транзакция не найдена',
    uz: 'Tranzaksiya topilmadi',
    en: 'Transaction not found',
  },
};

// ===========================================================================
// CLICK (Merchant API — Prepare/Complete, MD5 sign). Rasmiy error kodlari.
// ===========================================================================

/** Click `action` qiymatlari. */
export const ClickAction = {
  PREPARE: 0,
  COMPLETE: 1,
} as const;

/** Click error kodlari (rasmiy). 0 = muvaffaqiyat, manfiy = xato. */
export const ClickError = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5, // bizda: invoice topilmadi
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  REQUEST_FROM_CLICK_ERROR: -8,
  TRANSACTION_CANCELLED: -9,
} as const;
