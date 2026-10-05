import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/users', '/events', '/security'];

/**
 * Admin Frontend Middleware:
 * Protects admin dashboard pages, redirecting unauthenticated users to /login.
 * Also guards proxied /api/* mutations against CSRF when cookie-authed.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── CSRF guard for proxied API mutations (cookie auth only) ──
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const hasCookie = !!req.cookies.get('tt_session')?.value;
    const hasBearer = (req.headers.get('authorization') || '').startsWith('Bearer ');
    if (hasCookie && !hasBearer) {
      const origin = req.headers.get('origin') || '';
      const host = req.headers.get('host') || '';
      const csrfToken = req.headers.get('x-csrf-token');
      const sameHost = !!origin && (
        origin === `http://${host}` ||
        origin === `https://${host}`
      );
      if (!sameHost && csrfToken !== '1') {
        return new NextResponse(JSON.stringify({ error: 'CSRF validation failed.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const session = req.cookies.get('tt_session')?.value;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/users/:path*', '/events/:path*', '/security/:path*', '/api/:path*']
};
