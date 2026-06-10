import type { Metadata } from 'next';
import { ServicesClient } from '@/components/services/services-client';
import { requireClinicPermission } from '@/lib/auth/guard';
import { Permission } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: 'Xizmatlar' };

/** Xizmatlar — FAQAT SERVICE_MANAGE (CLINIC_ADMIN). */
export default function ServicesPage() {
  requireClinicPermission(Permission.SERVICE_MANAGE);
  return <ServicesClient />;
}
