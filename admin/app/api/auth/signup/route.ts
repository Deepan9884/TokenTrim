import { getStore, toPublic } from '@/lib/store';
import { json, sessionCookieHeader, requestMeta, clientIp } from '@/lib/session';
import { validateEmail, validatePassword, validatePin, validateName, normalizeEmail } from '@/lib/validation';
import { signupAllowed, signupRecorded } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // ── Rate limiting (by IP) ──────────────────────────────────────────
  const ip = clientIp(req) || 'unknown';
  const gate = signupAllowed(ip);
  if (!gate.ok) {
    return json(
      { error: `Too many signups. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minutes.` },
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
  const pin = String(body.pin || '');
  const name = String(body.name || '').trim();

  const err =
    validateEmail(email) || validatePassword(password) ||
    validatePin(pin) || validateName(name);
  if (err) return json({ error: err }, 400);

  const store = getStore();
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@tokentrim.local').toLowerCase();
    const user = await store.createUser({
      email, name, password, pin,
      isAdmin: email === adminEmail
    });
    signupRecorded(ip);
    await store.touchLogin(user.id);
    const meta = requestMeta(req);
    const token = await store.createSession(user.id, { device: meta.device, ip: meta.ip });
    const full = await store.findUserById(user.id);
    return json(
      // token is echoed for non-browser clients (extension sends it as Bearer)
      { user: full ? toPublic(full) : user, token },
      201,
      { 'Set-Cookie': sessionCookieHeader(token) }
    );
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === 'EXISTS') return json({ error: (e as Error).message }, 409);
    return json({ error: 'Sign up failed. Try again.' }, 500);
  }
}

