'use client';

import { useEffect } from 'react';
import { useAuthStore, type SessionUser } from '@/store/auth-store';

/**
 * Server'da aniqlangan foydalanuvchini client Zustand store'iga hydrate qiladi.
 * Panel layout'larida render qilinadi (server -> client ko'prik).
 */
export function AuthHydrator({ user }: { user: SessionUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  useEffect(() => {
    setUser(user);
  }, [user, setUser]);
  return null;
}
