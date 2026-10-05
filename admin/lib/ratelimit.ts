/**
 * In-memory rate limiter (single instance).
 *
 * Buckets:
 *   PIN recovery  — 5 tries / 15 min  (keyed by email)
 *   Signin        — 5 tries / 15 min  (keyed by IP)
 *   Signup        — 3 accts / 1 hour  (keyed by IP)
 *   Events ingest — 30 req / 1 min    (keyed by IP)
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// ── PIN recovery (existing) ──────────────────────────────────────────

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 15 * 60 * 1000;

export function pinAllowed(key: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`pin:${key}`, PIN_MAX_ATTEMPTS, PIN_WINDOW_MS);
}

export function pinFailed(key: string): void {
  _recordHit(`pin:${key}`, PIN_WINDOW_MS);
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
}

// ── Events ingest protection ─────────────────────────────────────────

export const EVENTS_MAX_REQUESTS = 30;
export const EVENTS_WINDOW_MS = 60 * 1000;

export function eventsAllowed(ip: string): { ok: boolean; retryAfterSec: number } {
  return _checkBucket(`events:${ip}`, EVENTS_MAX_REQUESTS, EVENTS_WINDOW_MS);
}

export function eventsRecorded(ip: string): void {
  _recordHit(`events:${ip}`, EVENTS_WINDOW_MS);
}

// ── Internals ────────────────────────────────────────────────────────

function _checkBucket(rawKey: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const key = rawKey.toLowerCase();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { ok: true, retryAfterSec: 0 };
  if (b.count < max) return { ok: true, retryAfterSec: 0 };
  return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

function _recordHit(rawKey: string, windowMs: number): void {
  const now = Date.now();
  const key = rawKey.toLowerCase();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
  }
}

// Periodic cleanup: drop stale buckets every 5 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 5 * 60 * 1000).unref?.();
