/** Kassa (bemor to'lovi) konstantalari — DB enum EMAS, string + validatsiya. */

export const PatientInvoiceStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type PatientInvoiceStatus =
  (typeof PatientInvoiceStatus)[keyof typeof PatientInvoiceStatus];
export const ALL_PATIENT_INVOICE_STATUSES: string[] =
  Object.values(PatientInvoiceStatus);

/** Bemor to'lov usullari (abonent to'lovidan alohida). */
export const PatientPaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  PAYME: 'PAYME',
  CLICK: 'CLICK',
} as const;
export type PatientPaymentMethod =
  (typeof PatientPaymentMethod)[keyof typeof PatientPaymentMethod];
export const ALL_PATIENT_PAYMENT_METHODS: string[] =
  Object.values(PatientPaymentMethod);
