/**
 * Obuna va klinika holatlari — PostgreSQL enum EMAS (spec 1.6.A), string konstantalar.
 */
export const SubscriptionStatus = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const ALL_SUBSCRIPTION_STATUSES: string[] =
  Object.values(SubscriptionStatus);

export const ClinicStatus = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;

export type ClinicStatus = (typeof ClinicStatus)[keyof typeof ClinicStatus];

export const ALL_CLINIC_STATUSES: string[] = Object.values(ClinicStatus);

export const BillingCycle = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const ALL_BILLING_CYCLES: string[] = Object.values(BillingCycle);
