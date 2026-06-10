/** Super Admin (platforma) javob shakllari. Pul string (Decimal). */

export interface PlanRef {
  id: string;
  name: string;
  price: string;
  billingCycle: string;
}

export interface ClinicSubscription {
  id: string;
  clinicId: string;
  status: string;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string | null;
  graceUntil: string | null;
  plan: PlanRef | null;
}

export interface ClinicItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  membersCount: number;
  subscription: ClinicSubscription | null;
}

export interface CreateClinicResult {
  clinic: ClinicItem;
  admin: {
    id: string;
    fullName: string;
    email: string | null;
    role: string;
    temporaryPassword?: string;
  };
  subscription: ClinicSubscription;
}

export interface PlanLimits {
  maxStaff?: number;
  maxPatients?: number;
  storageGb?: number;
  smsCount?: number;
}
export interface PlanFeatures {
  pharmacy?: boolean;
  telegram?: boolean;
  [key: string]: boolean | undefined;
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  currency: string;
  billingCycle: string;
  limits: PlanLimits;
  features: PlanFeatures;
  isActive: boolean;
  createdAt: string;
}

export interface AdminInvoice {
  id: string;
  clinicId: string;
  invoiceNumber: string;
  totalAmount: string;
  paidAmount: string;
  debtAmount: string;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
}

// ---- Platforma hisobotlari (7B API) ----
export interface StatusCount {
  status: string;
  count: number;
}
export interface PlatformOverview {
  clinics: { total: number; byStatus: StatusCount[] };
  subscriptions: { active: number; byStatus: StatusCount[] };
}
export interface PeriodPoint {
  period: string;
  count: number;
  total: string;
}
export interface ProviderPoint {
  provider: string;
  count: number;
  total: string;
}
export interface PlatformRevenue {
  range: { from: string; to: string; groupBy: string };
  byPeriod: PeriodPoint[];
  byProvider: ProviderPoint[];
  totals: { count: number; total: string };
}
export interface ExpiringSub {
  clinicId: string;
  clinicName: string | null;
  nextBillingDate: string | null;
}
export interface DebtorClinic {
  clinicId: string;
  clinicName: string | null;
  totalDebt: string;
}
export interface PlatformSubscriptions {
  active: number;
  byStatus: StatusCount[];
  expiringSoon: { days: number; count: number; items: ExpiringSub[] };
  debtors: { count: number; totalDebt: string; items: DebtorClinic[] };
}
export interface TopClinicRow {
  clinicId: string;
  clinicName: string | null;
  patients: number;
  appointments: number;
}
export interface TopClinicsReport {
  range: { from: string; to: string; groupBy: string };
  rows: TopClinicRow[];
}
