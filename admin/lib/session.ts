/** Cookie session helpers shared by API routes and server components. */
import { cookies } from 'next/headers';
import { getStore, type PublicUser } from './store';

export const SESSION_COOKIE = 'tt_session';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function tokenFromRequest(req: Request): Promise<string | null> {
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

export async function sessionUser(req: Request): Promise<PublicUser | null> {
  const token = await tokenFromRequest(req);
  if (!token) return null;
  try {
    return await getStore().getSessionUser(token);
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Best-effort client IP for audit / rate-limiting (hardened against leftmost spoofing). */
export function clientIp(req: Request): string | null {
  const h = (n: string) => req.headers.get(n);
  // Standard trusted reverse-proxy headers (Vercel, Cloudflare, AWS)
  const trusted = h('x-vercel-ip') || h('cf-connecting-ip') || h('x-real-ip');
  if (trusted) return trusted.trim().slice(0, 64);

  const forwarded = h('x-forwarded-for');
  if (forwarded) {
    // Reverse proxies append the real IP to the end. Taking the rightmost non-empty IP prevents client header spoofing.
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1].slice(0, 64);
    }
  }
  return null;
}

/** Short human device label from User-Agent (never store the full string in profiles). */
export function deviceLabel(req: Request): string | null {
  const ua = req.headers.get('user-agent') || '';
  if (!ua) return null;
  const low = ua.toLowerCase();
  let os = 'Unknown OS';
  if (low.includes('windows')) os = 'Windows';
  else if (low.includes('mac os') || low.includes('macintosh')) os = 'macOS';
  else if (low.includes('android')) os = 'Android';
  else if (low.includes('iphone') || low.includes('ipad')) os = 'iOS';
  else if (low.includes('linux')) os = 'Linux';
  let browser = 'Browser';
  if (low.includes('edg/')) browser = 'Edge';
  else if (low.includes('chrome/') && !low.includes('edg/')) browser = 'Chrome';
  else if (low.includes('firefox/')) browser = 'Firefox';
  else if (low.includes('safari/') && low.includes('version/')) browser = 'Safari';
  return `${browser} · ${os}`.slice(0, 120);
}

export function requestMeta(req: Request): { ip: string | null; device: string | null; userAgent: string | null } {
  return { ip: clientIp(req), device: deviceLabel(req), userAgent: (req.headers.get('user-agent') || '').slice(0, 200) || null };
}

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
}
