import { cookies } from 'next/headers';
import { backendRefresh, callBackend } from '@/lib/api/backend';
import { COOKIE } from '@/lib/cookies';
import type { ApiResponse } from '@/types/api';
import type { IssuedTokens, Role } from '@/types/auth';

export interface SessionUser {
  fullName: string;
  role: Role;
  clinicSlug?: string;
}

/**
 * Joriy foydalanuvchi identifikatori — httpOnly cookie'lardan (login'da yozilgan,
 * backend tomonidan tasdiqlangan). Backendga MUROJAAT QILMAYDI: tez + SUSPENDED
 * klinikada ham ishlaydi (/auth/me suspended'da bloklanadi). Haqiqiy avtorizatsiya
 * har data-call'da backend tomonidan tekshiriladi (proxy).
 */
export function getSessionUser(): SessionUser | null {
  const store = cookies();
  const refresh = store.get(COOKIE.refresh)?.value;
  const role = store.get(COOKIE.role)?.value as Role | undefined;
  if (!refresh || !role) return null;
  return {
    fullName: safeDecode(store.get(COOKIE.name)?.value ?? ''),
    role,
    clinicSlug: store.get(COOKIE.clinicSlug)?.value,
  };
}

export interface ServerJson<T> {
  status: number;
  data: T | null;
}

/**
 * Server component'dan backendga GET (BFF). 401 bo'lsa refresh token bilan
 * SO'ROV ICHIDA (in-memory) yangilaб qayta uradi. YANGI tokenni cookie'ga
 * yozolmaydi (server component cheklovi) — proxy buni keyingi data-call'da
 * bajaradi. Avtorizatsiya umuman yo'q bo'lsa null qaytaradi.
 */
export async function serverGetJson<T>(
  path: string,
): Promise<ServerJson<T> | null> {
  const store = cookies();
  let access = store.get(COOKIE.access)?.value;
  const refresh = store.get(COOKIE.refresh)?.value;
  if (!access && !refresh) return null;

  let res = access ? await callBackend(path, { accessToken: access }) : null;
  if ((!res || res.status === 401) && refresh) {
    const r = await backendRefresh(refresh);
    if (r.ok) {
      const j = (await r.json().catch(() => null)) as
        | ApiResponse<IssuedTokens>
        | null;
      if (j?.success && j.data) {
        access = j.data.accessToken;
        res = await callBackend(path, { accessToken: access });
      }
    }
  }
  if (!res) return null;
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  return { status: res.status, data: body?.data ?? null };
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
