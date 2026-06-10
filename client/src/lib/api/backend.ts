import { backendApiUrl } from '@/lib/config';

/**
 * Backend (NestJS) ga server-to-server (BFF) murojaat. FAQAT route handler /
 * server component'larda chaqiriladi — access token httpOnly cookie'dan keladi,
 * brauzerga ko'rinmaydi. `cache: 'no-store'` — autentifikatsiyalangan so'rovlar
 * keshlanmaydi.
 */
export async function callBackend(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<Response> {
  const { accessToken, headers, body, ...rest } = init;
  const h = new Headers(headers);
  if (accessToken) h.set('authorization', `Bearer ${accessToken}`);
  if (body && !h.has('content-type')) h.set('content-type', 'application/json');
  return fetch(backendApiUrl(path), {
    ...rest,
    headers: h,
    body,
    cache: 'no-store',
  });
}

/** Refresh token orqali yangi tokenlar oladi (rotatsiya bilan). */
export async function backendRefresh(refreshToken: string): Promise<Response> {
  return callBackend('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
