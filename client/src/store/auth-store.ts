'use client';

import { create } from 'zustand';
import type { Role } from '@/types/auth';

/**
 * Client-side foydalanuvchi holati (Zustand) — FAQAT nozik bo'lmagan ko'rsatuv
 * ma'lumoti (ism/rol/klinika). TOKEN bu yerda SAQLANMAYDI (httpOnly cookie'da).
 * Server'dan (layout) hydrate qilinadi.
 */
export interface SessionUser {
  fullName: string;
  role: Role;
  clinicSlug?: string;
}

interface AuthState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
