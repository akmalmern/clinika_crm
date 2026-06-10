import type { Metadata } from 'next';
import { PatientProfile } from '@/components/patients/patient-profile';

export const metadata: Metadata = { title: 'Bemor profili' };

export default function PatientProfilePage({
  params,
}: {
  params: { id: string };
}) {
  return <PatientProfile id={params.id} />;
}
