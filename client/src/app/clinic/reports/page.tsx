import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/layout/page-placeholder';

export const metadata: Metadata = { title: 'Hisobotlar' };

export default function ClinicReportsPage() {
  return (
    <PagePlaceholder
      title="Hisobotlar"
      description="Daromad, bemorlar oqimi, shifokorlar yuklamasi va top xizmatlar."
    />
  );
}
