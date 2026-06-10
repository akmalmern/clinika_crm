import type { Metadata } from 'next';
import { StaffClient } from '@/components/staff/staff-client';
import { requireClinicPermission } from '@/lib/auth/guard';
import { Permission } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: 'Xodimlar' };

/** Xodimlar — FAQAT CLINIC_ADMIN (STAFF_MANAGE). */
export default function StaffPage() {
  requireClinicPermission(Permission.STAFF_MANAGE);
  return <StaffClient />;
}
