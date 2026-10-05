import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/users', '/events', '/security'];

/**
 * Middleware:
 * 1. Presence check — redirects to /login if no session cookie.
 * 2. CSRF guard for state-changing API requests — rejects cookie-authed
 *    POST/PUT/DELETE that lack a valid origin or X-CSRF-Token header.
 *    Extension requests (Bearer auth, no cookies) are unaffected.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── CSRF guard for API mutations ──────────────────────────────────
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const hasCookie = !!req.cookies.get('tt_session')?.value;
    const hasBearer = (req.headers.get('authorization') || '').startsWith('Bearer ');

    // Only enforce CSRF for cookie-based auth (browser requests).
    // Extension uses Bearer tokens and is immune to CSRF (hasBearer bypasses).
    // An allowed CORS origin alone is NOT sufficient: require same-host
    // Origin OR an explicit X-CSRF-Token header.
    if (hasCookie && !hasBearer) {
      const origin = req.headers.get('origin') || '';
      const host = req.headers.get('host') || '';
      const csrfToken = req.headers.get('x-csrf-token');

      // Valid if: same-host request OR explicit CSRF token present.
      // chrome-extension:// origins must present the token (Bearer calls
      // already bypass this guard, so this only affects cookie misuse).
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

  // ── Protected page redirect ────────────────────────────────────────
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  if (!req.cookies.get('tt_session')?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/users/:path*', '/events/:path*', '/security/:path*',
    '/api/:path*'
  ]
};
