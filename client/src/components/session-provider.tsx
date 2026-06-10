'use client';

import { createContext, useContext } from 'react';
import { hasPermission } from '@/lib/auth/permissions';
import type { SessionUser } from '@/store/auth-store';

const SessionContext = createContext<SessionUser | null>(null);

/** Server'da aniqlangan foydalanuvchini client'ga sinxron uzatadi (gating flash'siz). */
export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSessionUser(): SessionUser {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    // Panel layout'lari ichida har doim mavjud; zaxira (login'siz render bo'lmaydi).
    return { fullName: '', role: 'CLINIC_ADMIN' as SessionUser['role'] };
  }
  return ctx;
}

/** Ruxsat tekshiruvi (UI gating). Haqiqiy himoya backend'da. */
export function useCan(): (permission: string) => boolean {
  const user = useSessionUser();
  return (permission: string) => hasPermission(user.role, permission);
}
