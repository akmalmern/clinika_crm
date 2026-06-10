import type { Metadata } from 'next';
import { EmrClient } from '@/components/emr/emr-client';
import { requireClinicPermission } from '@/lib/auth/guard';
import { Permission } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: 'Tibbiy yozuvlar' };

/**
 * EMR sahifasi — FAQAT EMR_READ ruxsatli rol (DOCTOR/NURSE/CLINIC_ADMIN).
 * CASHIER/RECEPTIONIST server tarafida dashboard'ga yo'naltiriladi (spec 8B).
 */
export default function EmrPage() {
  requireClinicPermission(Permission.EMR_READ);
  return <EmrClient />;
}
