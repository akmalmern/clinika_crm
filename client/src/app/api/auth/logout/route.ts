import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callBackend } from '@/lib/api/backend';
import { ALL_AUTH_COOKIES, COOKIE } from '@/lib/cookies';

/**
 * Logout (BFF): backendda tokenni blacklist qiladi (access mavjud bo'lsa),
 * so'ng barcha auth cookie'larni tozalaydi. Backend xato bersa ham cookie'lar
 * baribir o'chiriladi (mahalliy sessiya tugaydi).
 */
export async function POST(): Promise<NextResponse> {
  const store = cookies();
  const accessToken = store.get(COOKIE.access)?.value;

  if (accessToken) {
    await callBackend('/auth/logout', {
      method: 'POST',
      accessToken,
    }).catch(() => null);
  }

  const res = NextResponse.json({
    success: true,
    data: null,
    message: 'Tizimdan chiqildi',
  });
  for (const name of ALL_AUTH_COOKIES) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return res;
}
