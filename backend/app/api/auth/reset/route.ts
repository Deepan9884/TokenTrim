import { getStore, toPublic } from '@/lib/store';
import { json, sessionCookieHeader, requestMeta } from '@/lib/session';
import { validateEmail, validatePassword, validatePin, normalizeEmail } from '@/lib/validation';
import { pinAllowed, pinFailed, pinCleared } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/** Step 2 of recovery: email + 4-digit key → new password (auto sign-in). */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const email = normalizeEmail(body.email);
  const pin = String(body.pin || '');
  const newPassword = String(body.newPassword || '');
  const err = validateEmail(email) || validatePin(pin) || validatePassword(newPassword);
  if (err) return json({ error: err }, 400);

  const gate = pinAllowed(`reset:${email}`);
  if (!gate.ok) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minutes.` }, 429);
  }

  const store = getStore();
  const user = await store.findUserByEmail(email);
  // Uniform message: never reveal whether the email exists.
  if (!user || !store.verifyPin(user, pin)) {
    pinFailed(`reset:${email}`);
    if (user) {
      try {
        await store.recordFailedPin(user.id);
        await store.insertEvents([{
          user_id: user.id, event_name: 'security_pin_failed',
          properties: {}, session_id: null, client_version: null, platform: 'admin'
        }]);
      } catch { /* ignore */ }
    }
    return json({ error: 'Incorrect email or key.' }, 401);
  }
  pinCleared(`reset:${email}`);
  await store.clearFailedPin(user.id);
  await store.updatePassword(user.id, newPassword);
  await store.touchLogin(user.id);
  const meta = requestMeta(req);
  // New password = new single session; all old browsers are kicked.
  const token = await store.createSession(user.id, { device: meta.device, ip: meta.ip });
  const full = await store.findUserById(user.id);
  return json(
    // token is echoed for non-browser clients (extension sends it as Bearer)
    { user: full ? toPublic(full) : toPublic(user), token },
    200,
    { 'Set-Cookie': sessionCookieHeader(token) }
  );
}
