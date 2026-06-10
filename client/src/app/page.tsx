import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { homeForRole } from '@/lib/auth/roles';

/**
 * Ildiz: middleware odatda bu yerga yetib kelishdan oldin yo'naltiradi. Zaxira
 * sifatida sessiyaga qarab bosh sahifaga (yoki login'ga) jo'natadi.
 */
export default function Home() {
  const user = getSessionUser();
  redirect(user ? homeForRole(user.role) : '/login');
}
