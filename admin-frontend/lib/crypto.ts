/** Server-only hashing helpers (node:crypto scrypt, no extra deps). */
import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';

function scryptHash(secret: string, salt: string): string {
  return scryptSync(secret, salt, 64).toString('hex');
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashSecret(secret: string, salt: string): string {
  return `${salt}:${scryptHash(secret, salt)}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const idx = stored.indexOf(':');
  if (idx < 1) return false;
  const salt = stored.slice(0, idx);
  const expected = stored.slice(idx + 1);
  const actual = scryptHash(secret, salt);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Short-lived admin action tokens (stateless HMAC, single-purpose).
// Issued after the admin re-verifies password + PIN, consumed by sensitive
// admin mutations (e.g. granting Pro). 5-minute TTL, single-use (best-effort
// in-memory replay set — tight TTL bounds the residual risk).
// ---------------------------------------------------------------------------

export const ACTION_TOKEN_TTL_MS = 5 * 60 * 1000;

// Consumed JTIs with expiry so replay protection survives longer than the
// previous "clear entire set at 10k" logic (which reset protection).
// In-memory is best-effort for single-instance dev; Supabase persistence
// (admin_action_tokens table, if present) is attempted for multi-instance.
const consumedActionTokens = new Map<string, number>();

function pruneConsumed(): void {
  const now = Date.now();
  for (const [jti, exp] of consumedActionTokens) {
    if (exp <= now) consumedActionTokens.delete(jti);
  }
  // Bound memory without dropping live entries: evict expired first,
  // then oldest if still absurdly large.
  if (consumedActionTokens.size > 10000) {
    const entries = [...consumedActionTokens.entries()].sort((a, b) => a[1] - b[1]);
    for (const [jti] of entries.slice(0, consumedActionTokens.size - 10000)) {
      consumedActionTokens.delete(jti);
    }
  }
}

function actionSecret(): Buffer {
  const s = process.env.ADMIN_ACTION_SECRET;
  if (s) {
    if (process.env.NODE_ENV === 'production' && s.length < 32) {
      throw new Error('Invalid secrets config: ADMIN_ACTION_SECRET must be >= 32 chars in production.');
    }
    return Buffer.from(s, 'utf8');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid secrets config: ADMIN_ACTION_SECRET is required in production.');
  }
  // Per-boot random secret: tokens die with the process (safe default for dev).
  if (!(globalThis as Record<string, unknown>).__ttActionSecret) {
    (globalThis as Record<string, unknown>).__ttActionSecret = randomBytes(32);
  }
  return (globalThis as Record<string, unknown>).__ttActionSecret as Buffer;
}

function b64urlEncode(input: Buffer | string): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export interface ActionTokenPayload {
  sub: string;
  purpose: string;
  iat: number;
  exp: number;
  jti: string;
}

export function signActionToken(adminId: string, purpose: string): string {
  const now = Date.now();
  const payload: ActionTokenPayload = {
    sub: adminId,
    purpose,
    iat: now,
    exp: now + ACTION_TOKEN_TTL_MS,
    jti: randomBytes(12).toString('hex')
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac('sha256', actionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the payload when the token is valid for this admin + purpose, else null. */
export function verifyActionToken(token: string, adminId: string, purpose: string): ActionTokenPayload | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = b64urlEncode(createHmac('sha256', actionSecret()).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as ActionTokenPayload;
    if (payload.sub !== adminId || payload.purpose !== purpose) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null;
    pruneConsumed();
    if (consumedActionTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Async cross-instance verification consulting admin_action_tokens table when Supabase is configured. */
export async function verifyActionTokenAsync(
  token: string,
  adminId: string,
  purpose: string
): Promise<ActionTokenPayload | null> {
  const local = verifyActionToken(token, adminId, purpose);
  if (!local) return null;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { data } = await sb
        .from('admin_action_tokens')
        .select('jti')
        .eq('jti', local.jti)
        .maybeSingle();
      if (data) {
        // Replay detected across instances
        consumedActionTokens.set(local.jti, local.exp);
        return null;
      }
    } catch {
      // Table may not exist yet in pre-migration database; in-memory check holds
    }
  }

  return local;
}

export function consumeActionToken(payload: ActionTokenPayload): void {
  try {
    pruneConsumed();
    consumedActionTokens.set(payload.jti, payload.exp);
    // Best-effort cross-instance persistence: if Supabase is configured and
    // an admin_action_tokens table exists, record the JTI.
    void persistConsumedJti(payload).catch(() => undefined);
  } catch { /* ignore */ }
}

export async function consumeActionTokenAsync(payload: ActionTokenPayload): Promise<void> {
  consumeActionToken(payload);
  await persistConsumedJti(payload).catch(() => undefined);
}

async function persistConsumedJti(payload: ActionTokenPayload): Promise<void> {
  if (!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) return;
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  await sb.from('admin_action_tokens').insert({
    jti: payload.jti,
    admin_id: payload.sub,
    purpose: payload.purpose,
    expires_at: new Date(payload.exp).toISOString()
  });
}
