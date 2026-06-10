import type { Metadata } from 'next';
import { WelcomeDashboard } from '@/components/layout/welcome-dashboard';
import { getSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Boshqaruv paneli' };

export default function ClinicDashboard() {
  const user = getSessionUser();
  return (
    <WelcomeDashboard
      greeting={`Xush kelibsiz, ${user?.fullName ?? 'Foydalanuvchi'}`}
      subtitle="Klinika kunlik holati va ko'rsatkichlari."
      stats={[
        { label: 'Bugungi qabullar' },
        { label: 'Bemorlar' },
        { label: 'Kunlik daromad' },
        { label: 'Qarzlar' },
      ]}
    />
  );
}
