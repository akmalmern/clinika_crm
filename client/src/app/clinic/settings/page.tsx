import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/layout/page-placeholder';

export const metadata: Metadata = { title: 'Sozlamalar' };

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Sozlamalar"
      description="Klinika profili, ish vaqti va sozlamalari."
    />
  );
}
