import type { Metadata } from 'next';
import { GlobalStatsClient } from '@/components/super-admin/reports/global-stats-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Statistika' };

export default function PlatformReportsPage() {
  requireSuperAdmin();
  return <GlobalStatsClient />;
}
