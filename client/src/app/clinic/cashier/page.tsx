import type { Metadata } from 'next';
import { CashierClient } from '@/components/cashier/cashier-client';
import { requireClinicPermission } from '@/lib/auth/guard';
import { Permission } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: 'Kassa' };

/** Kassa — PATIENT_INVOICE_READ (kassir/admin/registrator/shifokor). */
export default function CashierPage() {
  requireClinicPermission(Permission.PATIENT_INVOICE_READ);
  return <CashierClient />;
}
