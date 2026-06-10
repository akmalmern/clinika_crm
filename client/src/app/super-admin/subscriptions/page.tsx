import type { Metadata } from 'next';
import { SubscriptionsClient } from '@/components/super-admin/subscriptions/subscriptions-client';
import { requireSuperAdmin } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Obunalar' };

export default function SubscriptionsPage() {
  requireSuperAdmin();
  return <SubscriptionsClient />;
}
