'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navForRole } from '@/lib/auth/navigation';
import type { SessionUser } from '@/store/auth-store';
import { SessionProvider } from '@/components/session-provider';
import { Sidebar } from './sidebar';
import { Header } from './header';

/**
 * Asosiy ilova qobig'i: yon menyu (desktop fiks, mobil drawer) + yuqori panel +
 * tarkib. Menyu foydalanuvchi roliga qarab CLIENT tarafida hisoblanadi (icon
 * komponentlari server->client uzatilmaydi).
 */
export function AppShell({
  user,
  panelLabel,
  children,
}: {
  user: SessionUser;
  panelLabel: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = navForRole(user.role);

  return (
    <SessionProvider user={user}>
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 md:block">
        <Sidebar sections={sections} panelLabel={panelLabel} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              className="absolute -right-10 top-3 flex h-8 w-8 items-center justify-center rounded-md bg-background text-foreground shadow"
              onClick={() => setMobileOpen(false)}
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar sections={sections} panelLabel={panelLabel} />
          </div>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col md:pl-64')}>
        <Header user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </SessionProvider>
  );
}
