import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { serverConfig } from './config';

/**
 * httpOnly cookie nomlari (token brauzer JS'iga ko'rinmaydi — XSS himoyasi,
 * spec 10/12: localStorage ishlatilmaydi). `role`/`clinic_slug` ham httpOnly —
 * middleware server tarafida o'qiydi; brauzer JS o'zgartira olmaydi.
 */
export const COOKIE = {
  access: 'cc_access',
  refresh: 'cc_refresh',
  role: 'cc_role',
  clinicSlug: 'cc_clinic',
  name: 'cc_name',
} as const;

const isProd = process.env.NODE_ENV === 'production';

/** Access token cookie — qisqa umr (15 daqiqaga yaqin). */
export function accessCookie(value: string): ResponseCookie {
  return {
    name: COOKIE.access,
    value,
    httpOnly: true,
    secure: serverConfig.cookieSecure || isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 30, // 30 daqiqa (refresh proxy ichida ishlaydi)
  };
}

/** Refresh token cookie — uzoq umr (7 kun). */
export function refreshCookie(value: string): ResponseCookie {
  return {
    name: COOKIE.refresh,
    value,
    httpOnly: true,
    secure: serverConfig.cookieSecure || isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** Yordamchi (role / clinic slug) cookie — middleware marshrutlash uchun. */
export function metaCookie(name: string, value: string): ResponseCookie {
  return {
    name,
    value,
    httpOnly: true,
    secure: serverConfig.cookieSecure || isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** Barcha auth cookie nomlari (logout'da tozalash uchun). */
export const ALL_AUTH_COOKIES: string[] = [
  COOKIE.access,
  COOKIE.refresh,
  COOKIE.role,
  COOKIE.clinicSlug,
  COOKIE.name,
];
