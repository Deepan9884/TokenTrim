import { getStore, toPublic } from '@/lib/store';
import { json, sessionCookieHeader, requestMeta, clientIp } from '@/lib/session';
import { validateEmail, normalizeEmail } from '@/lib/validation';
import { verifySecret } from '@/lib/crypto';
import { signinAllowedAsync, signinFailed, signinCleared } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // ── Rate limiting (by IP, cross-instance when Supabase is set) ──────
  const ip = clientIp(req) || 'unknown';
  const gate = await signinAllowedAsync(ip);
  if (!gate.ok) {
    return json(
      { error: `Too many login attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minutes.` },
      429,
      { 'Retry-After': String(gate.retryAfterSec) }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const err = validateEmail(email) || (password ? null : 'Password is required.');
  if (err) return json({ error: err }, 400);

  const rawEmail = String(body.email || '').trim().toLowerCase();
  const store = getStore();
  let user = await store.findUserByEmail(email);
  if (!user && rawEmail !== email) {
    user = await store.findUserByEmail(rawEmail);
  }
  // Same message either way: never reveal whether the email exists.
  if (!user || !verifySecret(password, user.password_hash)) {
    signinFailed(ip);
    // Track failed login attempt for security dashboard
    try {
      await store.insertEvents([{
        user_id: user?.id || null,
        event_name: 'security_login_failed',
        properties: { ip, email_attempted: email.slice(0, 3) + '***' } as Record<string, unknown>,
        session_id: null,
        client_version: null,
        platform: 'unknown'
      }]);
    } catch { /* analytics must never break auth */ }
    return json({ error: 'Incorrect email or password.' }, 401);
  }
  // Successful login — clear rate limit for this IP
  signinCleared(ip);

  const meta = requestMeta(req);
  // SINGLE-BROWSER: createSession revokes every other live session for this user.
  const hadPriorSession = (user.active_sessions || 0) > 0;
  const prevDevice = user.current_device || null;
  const prevIp = user.current_ip || null;
  await store.touchLogin(user.id);
  const token = await store.createSession(user.id, { device: meta.device, ip: meta.ip });
  const rawPlatform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
  const origin = req.headers.get('origin') || '';
  const isExtension = rawPlatform === 'extension' || origin.startsWith('chrome-extension://');
  const platform = isExtension ? 'extension' : (rawPlatform === 'admin' ? 'admin' : (user.is_admin ? 'admin' : 'extension'));

  try {
    await store.insertEvents([{
      user_id: user.id,
      event_name: 'signin',
      properties: { platform, had_prior_session: hadPriorSession } as Record<string, unknown>,
      session_id: token.slice(0, 16),
      client_version: null,
      platform
    }]);
    if (hadPriorSession) {
      await store.insertEvents([{
        user_id: user.id,
        event_name: 'security_session_revoked',
        properties: { reason: 'new_login', prev_device: prevDevice || 'unknown', prev_ip: prevIp || 'unknown' } as Record<string, unknown>,
        session_id: token.slice(0, 16),
        client_version: null,
        platform
      }]);
    }
    if (prevIp && meta.ip && prevIp !== meta.ip) {
      await store.insertEvents([{
        user_id: user.id,
        event_name: 'security_ip_changed',
        properties: { old_ip: prevIp, new_ip: meta.ip } as Record<string, unknown>,
        session_id: token.slice(0, 16),
        client_version: null,
        platform
      }]);
    }
    if (prevDevice && meta.device && prevDevice !== meta.device) {
      await store.insertEvents([{
        user_id: user.id,
        event_name: 'security_device_changed',
        properties: { old_device: prevDevice, new_device: meta.device } as Record<string, unknown>,
        session_id: token.slice(0, 16),
        client_version: null,
        platform
      }]);
    }
  } catch { /* analytics must never break auth */ }
  const full = await store.findUserById(user.id);
  return json(
    // token is echoed for non-browser clients (extension sends it as Bearer)
    { user: full ? toPublic(full) : toPublic(user), token, sessionRevokedElsewhere: hadPriorSession },
    200,
    { 'Set-Cookie': sessionCookieHeader(token) }
  );
}

