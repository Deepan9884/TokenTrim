import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return true;
  // Chrome Extension
  if (origin.startsWith('chrome-extension://')) return true;
  // Localhost
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  // Same host
  if (origin === `http://${host}` || origin === `https://${host}`) return true;
  // Configured Admin Frontend (Netlify or custom domain)
  const allowedAdmin = process.env.ADMIN_ORIGIN || '';
  if (allowedAdmin) {
    const list = allowedAdmin.split(',').map((s) => s.trim().replace(/\/+$/, ''));
    if (list.includes(origin.replace(/\/+$/, '')) || list.includes('*')) return true;
  }
  // Allow Netlify preview and production subdomains by default if needed
  if (origin.endsWith('.netlify.app')) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const allowed = isAllowedOrigin(origin, host);
  const allowOriginHeader = allowed ? (origin || '*') : (process.env.ADMIN_ORIGIN || '*');

  // ── 1. Handle OPTIONS preflight requests ─────────────────────────────
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowOriginHeader,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }

  // ── 2. CSRF guard for cookie-authed state mutations ────────────────
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const hasCookie = !!req.cookies.get('tt_session')?.value;
    const hasBearer = (req.headers.get('authorization') || '').startsWith('Bearer ');

    // Only enforce CSRF for cookie-based browser requests.
    // Extension requests use Bearer tokens and are immune to CSRF.
    if (hasCookie && !hasBearer) {
      const csrfToken = req.headers.get('x-csrf-token');
      if (!allowed && csrfToken !== '1') {
        return new NextResponse(JSON.stringify({ error: 'CSRF validation failed or untrusted origin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  // ── 3. Append CORS headers to API responses ────────────────────────
  const response = NextResponse.next();
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', allowOriginHeader);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*']
};
