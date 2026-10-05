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

const consumedActionTokens = new Set<string>();

function actionSecret(): Buffer {
  const s = process.env.ADMIN_ACTION_SECRET;
  if (s) return Buffer.from(s, 'utf8');
  // Per-boot random secret: tokens die with the process (safe default).
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
    if (consumedActionTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function consumeActionToken(payload: ActionTokenPayload): void {
  try {
    consumedActionTokens.add(payload.jti);
    // Bound memory: drop the set if it ever grows absurd (TTL is 5 min).
    if (consumedActionTokens.size > 10000) consumedActionTokens.clear();
  } catch { /* ignore */ }
}
