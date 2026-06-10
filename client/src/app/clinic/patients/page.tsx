import type { Metadata } from 'next';
import { PatientsClient } from '@/components/patients/patients-client';

export const metadata: Metadata = { title: 'Bemorlar' };

export default function PatientsPage() {
  return <PatientsClient />;
}
