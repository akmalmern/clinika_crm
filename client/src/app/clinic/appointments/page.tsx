import type { Metadata } from 'next';
import { AppointmentsClient } from '@/components/appointments/appointments-client';

export const metadata: Metadata = { title: 'Qabullar' };

export default function AppointmentsPage() {
  return <AppointmentsClient />;
}
