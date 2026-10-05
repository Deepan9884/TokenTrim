import { getStore } from '@/lib/store';
import { json, sessionUser, requestMeta } from '@/lib/session';
import { verifySecret, signActionToken, ACTION_TOKEN_TTL_MS } from '@/lib/crypto';
import { pinAllowed, pinFailed, pinCleared } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Step-up authentication for sensitive admin mutations (e.g. granting Pro).
 * Verifies the admin's OWN password + 4-digit PIN, then issues a short-lived
 * single-use action token the client attaches as `X-Admin-Action`.
 * Rate-limited: 5 attempts / 15 min per admin + IP.
 */
export async function POST(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const meta = requestMeta(req);
  const bucketKey = `reauth:${me.id}:${meta.ip || 'unknown'}`;
  const gate = pinAllowed(bucketKey);
  if (!gate.ok) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} min.` }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const password = String(body.password || '');
  const pin = String(body.pin || '').trim();
  if (!password || !pin) return json({ error: 'Password and 4-digit key are required.' }, 400);

  const store = getStore();
  // Re-read the stored row (never trust the session copy for secrets).
  const admin = await store.findUserById(me.id);
  const passwordOk = !!admin && verifySecret(password, admin.password_hash);
  const pinOk = !!admin && store.verifyPin(admin, pin);

  if (!admin || !passwordOk || !pinOk) {
    pinFailed(bucketKey);
    try {
      await store.appendAuditLog({
        admin_id: me.id, action: 'reauth_failed', target_user_id: null,
        details: {}, ip: meta.ip, user_agent: meta.userAgent
      });
    } catch { /* ignore */ }
    // Same message either way: never reveal which credential was wrong.
    return json({ error: 'Verification failed. Check your password and 4-digit key.' }, 401);
  }

  pinCleared(bucketKey);
  const actionToken = signActionToken(me.id, 'grant_pro');
  try {
    await store.appendAuditLog({
      admin_id: me.id, action: 'reauth_grant', target_user_id: null,
      details: { purpose: 'grant_pro' }, ip: meta.ip, user_agent: meta.userAgent
    });
  } catch { /* ignore */ }
  return json({ ok: true, actionToken, expiresInSec: Math.floor(ACTION_TOKEN_TTL_MS / 1000) });
}
