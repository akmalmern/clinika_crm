import { redirect } from 'next/navigation';
import { getSessionUser, type SessionUser } from './session';
import { hasPermission } from './permissions';
import { homeForRole } from './roles';
import { Role } from '@/types/auth';

/**
 * Server-side ruxsat gate (sahifa darajasi). Ruxsat bo'lmasa dashboard'ga
 * yo'naltiradi — masalan CASHIER/RECEPTIONIST EMR sahifasini ochmaydi (spec 8B).
 * Backend ham har API'da tekshiradi (ikki qatlam).
 */
export function requireClinicPermission(permission: string): SessionUser {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (!hasPermission(user.role, permission)) redirect('/clinic/dashboard');
  return user;
}

/** Faqat SUPER_ADMIN. Boshqa rol o'z bosh sahifasiga yo'naltiriladi (spec 8C). */
export function requireSuperAdmin(): SessionUser {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== Role.SUPER_ADMIN) redirect(homeForRole(user.role));
  return user;
}
