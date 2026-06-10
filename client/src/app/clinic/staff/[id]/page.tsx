import type { Metadata } from 'next';
import { MemberProfile } from '@/components/staff/member-profile';
import { requireClinicPermission } from '@/lib/auth/guard';
import { Permission } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: 'Xodim profili' };

export default function StaffProfilePage({
  params,
}: {
  params: { id: string };
}) {
  requireClinicPermission(Permission.STAFF_MANAGE);
  return <MemberProfile id={params.id} />;
}
