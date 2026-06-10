import type { Metadata } from 'next';
import { PlansClient } from '@/components/super-admin/plans/plans-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Tariflar' };

export default function PlansPage() {
  requireSuperAdmin();
  return <PlansClient />;
}
