import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendRefresh, callBackend } from '@/lib/api/backend';
import {
  accessCookie,
  ALL_AUTH_COOKIES,
  COOKIE,
  refreshCookie,
} from '@/lib/cookies';
import type { ApiResponse } from '@/types/api';
import type { IssuedTokens } from '@/types/auth';

export const dynamic = 'force-dynamic';

/**
 * Backend'ga UZATILMAYDIGAN sarlavhalar: hop-by-hop (RFC 7230) + xavfsizlik
 * (cookie/authorization'ni o'zimiz boshqaramiz) + `expect` (undici fetch
 * "expect header not supported" — ba'zi mijozlar 100-continue yuboradi).
 */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-connection',
  'expect',
  'content-length',
  'accept-encoding',
  'cookie',
  'authorization',
]);

interface RouteCtx {
  params: { path?: string[] };
}

async function tryRefresh(refreshToken: string): Promise<IssuedTokens | null> {
  const r = await backendRefresh(refreshToken);
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as ApiResponse<IssuedTokens> | null;
  return j?.success && j.data ? j.data : null;
}

/**
 * Universal backend proxy (BFF). Brauzer `/api/backend/*` ga boradi; bu handler
 * httpOnly cookie'dagi access tokenni qo'shib NestJS `/api/v1/*` ga uzatadi.
 * 401 bo'lsa refresh token bilan BIR MARTA yangilaб qayta uradi (avtomatik
 * refresh) va yangi tokenlarni cookie'ga yozadi. Refresh ham muvaffaqiyatsiz
 * bo'lsa cookie'lar tozalanadi (keyingi navigatsiyada middleware login'ga
 * yo'naltiradi). Token brauzerga HECH QACHON ko'rinmaydi.
 */
async function handle(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const path = '/' + (ctx.params.path?.join('/') ?? '');
  const search = req.nextUrl.search;
  const method = req.method;

  const store = cookies();
  let accessToken = store.get(COOKIE.access)?.value;
  const refreshToken = store.get(COOKIE.refresh)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      { success: false, data: null, message: 'Avtorizatsiya talab qilinadi' },
      { status: 401 },
    );
  }

  const fwdHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) fwdHeaders.set(key, value);
  });

  const rawBody =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : Buffer.from(await req.arrayBuffer());

  const target = `${path}${search}`;
  let backendRes = await callBackend(target, {
    method,
    headers: fwdHeaders,
    body: rawBody,
    accessToken,
  });

  let newTokens: IssuedTokens | null = null;
  if (backendRes.status === 401 && refreshToken) {
    newTokens = await tryRefresh(refreshToken);
    if (newTokens) {
      accessToken = newTokens.accessToken;
      backendRes = await callBackend(target, {
        method,
        headers: fwdHeaders,
        body: rawBody,
        accessToken,
      });
    }
  }

  const resBuffer = await backendRes.arrayBuffer();
  const res = new NextResponse(resBuffer, { status: backendRes.status });
  for (const h of ['content-type', 'content-disposition']) {
    const v = backendRes.headers.get(h);
    if (v) res.headers.set(h, v);
  }

  if (newTokens) {
    res.cookies.set(accessCookie(newTokens.accessToken));
    res.cookies.set(refreshCookie(newTokens.refreshToken));
  } else if (backendRes.status === 401) {
    // Refresh ishlamadi / muddati tugadi -> mahalliy sessiyani tozalaymiz.
    for (const name of ALL_AUTH_COOKIES) {
      res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
  }
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
