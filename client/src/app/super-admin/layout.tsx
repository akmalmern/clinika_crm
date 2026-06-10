import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrator } from '@/components/auth-hydrator';
import { getSessionUser } from '@/lib/auth/session';
import { homeForRole, isSuperAdmin } from '@/lib/auth/roles';

/**
 * Super Admin paneli (spec 12). FAQAT SUPER_ADMIN. Boshqa rol o'z bosh sahifasiga
 * yo'naltiriladi (middleware ham, bu yerda ham — ikki qatlam himoya).
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (!isSuperAdmin(user.role)) redirect(homeForRole(user.role));

  return (
    <>
      <AuthHydrator user={user} />
      <AppShell user={user} panelLabel="Platforma">
        {children}
      </AppShell>
    </>
  );
}
