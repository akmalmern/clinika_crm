import type { Metadata } from 'next';
import { DashboardClient } from '@/components/super-admin/dashboard/dashboard-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Boshqaruv paneli' };

export default function SuperAdminDashboard() {
  requireSuperAdmin();
  return <DashboardClient />;
}
