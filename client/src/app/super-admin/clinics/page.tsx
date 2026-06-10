import type { Metadata } from 'next';
import { ClinicsClient } from '@/components/super-admin/clinics/clinics-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Klinikalar' };

export default function ClinicsPage() {
  requireSuperAdmin();
  return <ClinicsClient />;
}
