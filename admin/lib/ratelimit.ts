/**
 * Rate limiter: in-memory fast path + Supabase-backed cross-instance enforcement.
 *
 * Sync functions (pinAllowed, signinAllowed, ...) preserve the existing API and
 * are safe for single-instance dev/demo. Async `*Async` variants additionally
 * consult the `rate_limit_hits` table when Supabase is configured, so limits
 * hold across serverless instances. Routes should prefer the Async variants.
 *
 * Buckets:
 *   PIN recovery  — 5 tries / 15 min  (keyed by email)
 *   Signin        — 5 tries / 15 min  (keyed by IP)
 *   Signup        — 3 accts / 1 hour  (keyed by IP)
 *   Events ingest — 30 req / 1 min    (keyed by IP)
 *   Reauth        — 5 tries / 15 min  (keyed by admin+IP)
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// ── PIN recovery ─────────────────────────────────────────────────────

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 15 * 60 * 1000;

export function pinAllowed(key: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`pin:${key}`, PIN_MAX_ATTEMPTS, PIN_WINDOW_MS);
}

export function pinFailed(key: string): void {
  _recordHit(`pin:${key}`, PIN_WINDOW_MS);
  void persistHit(`pin:${key}`, PIN_WINDOW_MS).catch(() => undefined);
}

export function pinCleared(key: string): void {
  buckets.delete(`pin:${key}`.toLowerCase());
}

// ── Signin brute-force protection ────────────────────────────────────

export const SIGNIN_MAX_ATTEMPTS = 5;
export const SIGNIN_WINDOW_MS = 15 * 60 * 1000;

export function signinAllowed(ip: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`signin:${ip}`, SIGNIN_MAX_ATTEMPTS, SIGNIN_WINDOW_MS);
}

export function signinFailed(ip: string): void {
  _recordHit(`signin:${ip}`, SIGNIN_WINDOW_MS);
  void persistHit(`signin:${ip}`, SIGNIN_WINDOW_MS).catch(() => undefined);
}

export function signinCleared(ip: string): void {
  buckets.delete(`signin:${ip}`.toLowerCase());
}

// ── Signup spam protection ───────────────────────────────────────────

export const SIGNUP_MAX_ATTEMPTS = 3;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export function signupAllowed(ip: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`signup:${ip}`, SIGNUP_MAX_ATTEMPTS, SIGNUP_WINDOW_MS);
}

export function signupRecorded(ip: string): void {
  _recordHit(`signup:${ip}`, SIGNUP_WINDOW_MS);
  void persistHit(`signup:${ip}`, SIGNUP_WINDOW_MS).catch(() => undefined);
}

// ── Events ingest protection ─────────────────────────────────────────

export const EVENTS_MAX_REQUESTS = 30;
export const EVENTS_WINDOW_MS = 60 * 1000;

export function eventsAllowed(ip: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`events:${ip}`, EVENTS_MAX_REQUESTS, EVENTS_WINDOW_MS);
}

export function eventsRecorded(ip: string): void {
  _recordHit(`events:${ip}`, EVENTS_WINDOW_MS);
  // Events are high-volume; skip cross-instance persistence for this bucket
  // (per-instance 30/min remains a useful abuse brake without DB writes).
}

// ── Reauth (admin step-up) protection ────────────────────────────────

export const REAUTH_MAX_ATTEMPTS = 5;
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;

export function reauthAllowed(key: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`reauth:${key}`, REAUTH_MAX_ATTEMPTS, REAUTH_WINDOW_MS);
}

export function reauthFailed(key: string): void {
  _recordHit(`reauth:${key}`, REAUTH_WINDOW_MS);
  void persistHit(`reauth:${key}`, REAUTH_WINDOW_MS).catch(() => undefined);
}

export function reauthCleared(key: string): void {
  buckets.delete(`reauth:${key}`.toLowerCase());
}

// ── Async cross-instance variants (prefer in routes) ─────────────────

async function sharedCount(key: string, windowMs: number): Promise<number> {
  if (!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) return 0;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count } = await sb
      .from('rate_limit_hits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', key.toLowerCase())
      .gte('created_at', since);
    return count || 0;
  } catch {
    return 0;
  }
}

async function checkBucketAsync(
  rawKey: string,
  max: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const local = _checkBucket(rawKey, max, windowMs);
  if (!local.ok) return local;
  const shared = await sharedCount(rawKey, windowMs);
  if (shared >= max) {
    // Mirror the shared denial locally so subsequent sync checks also fail.
    _recordHit(rawKey, windowMs);
    const retry = _checkBucket(rawKey, max, windowMs);
    return { ok: false, retryAfterSec: Math.max(retry.retryAfterSec, 60) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export const pinAllowedAsync = (k: string) => checkBucketAsync(`pin:${k}`, PIN_MAX_ATTEMPTS, PIN_WINDOW_MS);
export const signinAllowedAsync = (ip: string) => checkBucketAsync(`signin:${ip}`, SIGNIN_MAX_ATTEMPTS, SIGNIN_WINDOW_MS);
export const signupAllowedAsync = (ip: string) => checkBucketAsync(`signup:${ip}`, SIGNUP_MAX_ATTEMPTS, SIGNUP_WINDOW_MS);
export const eventsAllowedAsync = (ip: string) => checkBucketAsync(`events:${ip}`, EVENTS_MAX_REQUESTS, EVENTS_WINDOW_MS);
export const reauthAllowedAsync = (k: string) => checkBucketAsync(`reauth:${k}`, REAUTH_MAX_ATTEMPTS, REAUTH_WINDOW_MS);

// ── Internals ────────────────────────────────────────────────────────

function _checkBucket(rawKey: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  pruneIfNeeded();
  const now = Date.now();
  const key = rawKey.toLowerCase();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { ok: true, retryAfterSec: 0 };
  if (b.count < max) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

function _recordHit(rawKey: string, windowMs: number): void {
  pruneIfNeeded();
  const now = Date.now();
  const key = rawKey.toLowerCase();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
  }
}

let lastPrune = 0;
function pruneIfNeeded(): void {
  const now = Date.now();
  if (now - lastPrune < 60 * 1000 && buckets.size < 10000) return;
  lastPrune = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
  // Bound memory without dropping live buckets arbitrarily.
  if (buckets.size > 10000) {
    const entries = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [k] of entries.slice(0, buckets.size - 10000)) buckets.delete(k);
  }
}

async function persistHit(rawKey: string, windowMs: number): Promise<void> {
  if (!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) return;
  // Skip high-volume events bucket to avoid DB write amplification.
  if (rawKey.toLowerCase().startsWith('events:')) return;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    await sb.from('rate_limit_hits').insert({
      bucket: rawKey.toLowerCase(),
      window_ms: windowMs
    });
  } catch {
    // Best-effort only; memory bucket remains the enforcement point.
  }
}

// Periodic cleanup: drop stale buckets every 5 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 5 * 60 * 1000).unref?.();
