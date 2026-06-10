import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrator } from '@/components/auth-hydrator';
import { getSessionUser, serverGetJson } from '@/lib/auth/session';
import { homeForRole, isClinicRole } from '@/lib/auth/roles';

const SUSPENDED_PATH = '/clinic/billing/suspended';

interface BillingStatus {
  paymentRequired: boolean;
}

/**
 * Klinika paneli (spec 12). FAQAT klinika rollari. SUSPENDED obuna (spec 5.3):
 * backend `/billing/status` authoritativ — to'lov kerak bo'lsa foydalanuvchi
 * FAQAT to'lov sahifasini ko'radi (yon menyusiz). Aks holda to'liq qobiq.
 */
export default async function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (!isClinicRole(user.role)) redirect(homeForRole(user.role));

  const status = await serverGetJson<BillingStatus>('/billing/status');
  if (!status || status.status === 401) redirect('/login');

  const paymentRequired = status.data?.paymentRequired ?? false;
  const pathname = headers().get('x-pathname') ?? '';
  const onSuspendedPage = pathname.startsWith(SUSPENDED_PATH);

  if (paymentRequired && !onSuspendedPage) redirect(SUSPENDED_PATH);
  if (!paymentRequired && onSuspendedPage) redirect('/clinic/dashboard');

  // SUSPENDED -> yon menyusiz minimal ko'rinish (faqat to'lov sahifasi).
  if (paymentRequired) {
    return (
      <>
        <AuthHydrator user={user} />
        {children}
      </>
    );
  }

  return (
    <>
      <AuthHydrator user={user} />
      <AppShell user={user} panelLabel="Klinika">
        {children}
      </AppShell>
    </>
  );
}
