import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function parseAdminOrigins(): string[] {
  const raw = process.env.ADMIN_ORIGIN || '';
  return raw.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return true;
  // Chrome Extension (Bearer-authed; cookies are never sent cross-origin here,
  // but keep the origin allowlisted so Bearer calls pass preflight).
  if (origin.startsWith('chrome-extension://')) return true;
  // Localhost is allowed only outside production. In production every
  // non-extension caller must be explicitly listed in ADMIN_ORIGIN.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return true;
  // Same host
  if (origin === `http://${host}` || origin === `https://${host}`) return true;
  // Configured Admin Frontend origins (exact match only — no wildcards).
  const list = parseAdminOrigins();
  if (list.includes(origin.replace(/\/+$/, ''))) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const allowed = isAllowedOrigin(origin, host);
  // Never reflect an untrusted origin with credentials. Fall back to the
  // first configured admin origin, else omit the header (no '*'+credentials).
  const configured = parseAdminOrigins()[0] || '';
  const allowOriginHeader = allowed ? (origin || configured) : configured;

  const isExtension = origin.startsWith('chrome-extension://');

  // ── 1. Handle OPTIONS preflight requests ─────────────────────────────
  if (req.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    // Only send credentialed CORS headers for explicitly allowed web origins.
    // Chrome extensions authenticate exclusively via Bearer tokens (never cookies).
    if (allowed && allowOriginHeader) {
      headers['Access-Control-Allow-Origin'] = allowOriginHeader;
      if (!isExtension) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // ── 2. CSRF guard for cookie-authed state mutations ────────────────
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const hasCookie = !!req.cookies.get('tt_session')?.value;
    const hasBearer = (req.headers.get('authorization') || '').startsWith('Bearer ');

    // Only enforce CSRF for cookie-based browser requests.
    // Extension requests use Bearer tokens and are immune to CSRF.
    // A valid same-host Origin OR an explicit X-CSRF-Token is required —
    // an allowed CORS origin alone is NOT sufficient.
    if (hasCookie && !hasBearer) {
      const csrfToken = req.headers.get('x-csrf-token');
      const sameHost = origin === `http://${host}` || origin === `https://${host}`;
      if (!sameHost && csrfToken !== '1') {
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
    if (allowed && allowOriginHeader) {
      response.headers.set('Access-Control-Allow-Origin', allowOriginHeader);
      if (!isExtension) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*']
};
