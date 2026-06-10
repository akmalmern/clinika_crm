import type { Metadata } from 'next';
import { ClinicDetail } from '@/components/super-admin/clinics/clinic-detail';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Klinika tafsiloti' };

export default function ClinicDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requireSuperAdmin();
  return <ClinicDetail id={params.id} />;
}
