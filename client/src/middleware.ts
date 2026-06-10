import { NextRequest, NextResponse } from 'next/server';
import { COOKIE } from '@/lib/cookies';
import { canAccessPanel, homeForRole } from '@/lib/auth/roles';

/**
 * Route himoyasi (spec 12): login qilmagan foydalanuvchi /login ga; noto'g'ri
 * panelga kirgan rol o'z bosh sahifasiga yo'naltiriladi. "Logged in" signali =
 * refresh cookie (uzoq umrli) + role cookie mavjudligi. Access token vaqtincha
 * eskirgan bo'lsa ham proxy uni yangilaydi.
 *
 * Har so'rovga `x-pathname` sarlavhasi qo'shiladi — server layout joriy yo'lni
 * biladi (SUSPENDED redirect siklini oldini olish uchun).
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get(COOKIE.role)?.value;
  const isLoggedIn = !!req.cookies.get(COOKIE.refresh)?.value && !!role;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (pathname === '/') {
    return isLoggedIn ? redirect(homeForRole(role)) : redirect('/login');
  }

  if (pathname === '/login') {
    return isLoggedIn ? redirect(homeForRole(role)) : pass();
  }

  if (!isLoggedIn) {
    const url = new URL('/login', req.url);
    if (pathname && pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith('/super-admin') &&
    !canAccessPanel(role, 'super-admin')
  ) {
    return redirect(homeForRole(role));
  }
  if (pathname.startsWith('/clinic') && !canAccessPanel(role, 'clinic')) {
    return redirect(homeForRole(role));
  }

  return pass();
}

export const config = {
  // /api (BFF), _next, statik fayllar (nuqtali) middleware'dan tashqarida.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
