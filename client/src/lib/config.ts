/**
 * Server-side konfiguratsiya (FAQAT route handler / server component'larda
 * o'qiladi — bu qiymatlar brauzerga yuborilmaydi). Token httpOnly cookie'da.
 */
export const serverConfig = {
  /** Backend (NestJS) ichki manzili — server-to-server (BFF). */
  backendUrl: process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3000',
  /** API prefiksi (NestJS global prefix). */
  apiPrefix: '/api/v1',
  /** Cookie Secure bayrog'i (prod HTTPS -> true). */
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};

/** To'liq backend API URL quradi: `${backendUrl}${apiPrefix}${path}`. */
export function backendApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${serverConfig.backendUrl}${serverConfig.apiPrefix}${p}`;
}
