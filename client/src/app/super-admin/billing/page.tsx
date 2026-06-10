import type { Metadata } from 'next';
import { BillingClient } from '@/components/super-admin/billing/billing-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: "To'lovlar" };

export default function BillingPage() {
  requireSuperAdmin();
  return <BillingClient />;
}
