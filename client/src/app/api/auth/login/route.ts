import { NextRequest, NextResponse } from 'next/server';
import { callBackend } from '@/lib/api/backend';
import {
  accessCookie,
  COOKIE,
  metaCookie,
  refreshCookie,
} from '@/lib/cookies';
import type { ApiResponse } from '@/types/api';
import type { LoginResult } from '@/types/auth';

/**
 * Login (BFF): backendga so'rovni uzatadi, muvaffaqiyatda tokenlarni httpOnly
 * cookie'ga yozadi va FAQAT user profilini qaytaradi (tokenlar brauzerга
 * KETMAYDI — XSS himoyasi, spec 10/12). Xato bo'lsa backend xatosini o'tkazadi.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const backendRes = await callBackend('/auth/login', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });

  const json = (await backendRes.json().catch(() => null)) as
    | ApiResponse<LoginResult>
    | null;

  if (!backendRes.ok || !json?.success || !json.data) {
    return NextResponse.json(
      json ?? { success: false, data: null, message: 'Login xatosi' },
      { status: backendRes.status || 502 },
    );
  }

  const { user, tokens } = json.data;
  const res = NextResponse.json({
    success: true,
    data: { user },
    message: json.message,
  });
  res.cookies.set(accessCookie(tokens.accessToken));
  res.cookies.set(refreshCookie(tokens.refreshToken));
  res.cookies.set(metaCookie(COOKIE.role, user.role));
  // Ism non-ASCII bo'lishi mumkin (lotin/kirill) -> URL-encode.
  res.cookies.set(metaCookie(COOKIE.name, encodeURIComponent(user.fullName)));
  if (user.clinicSlug) {
    res.cookies.set(metaCookie(COOKIE.clinicSlug, user.clinicSlug));
  }
  return res;
}
