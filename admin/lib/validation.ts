/** Pure input validation — no dependencies, unit-tested from root vitest. */

const TYPO_DOMAINS: Record<string, string> = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

export function fixEmailTypo(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  const corrected = TYPO_DOMAINS[domain.toLowerCase()];
  return corrected ? `${local}@${corrected}` : email;
}

export function normalizeEmail(email: unknown): string {
  const s = String(email || '').trim().toLowerCase();
  return fixEmailTypo(s);
}

export function validateEmail(email: unknown): string | null {
  const e = normalizeEmail(email);
  if (!e) return 'Email is required.';
  if (e.length > 254) return 'Email is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: unknown): string | null {
  const p = String(password || '');
  if (!p) return 'Password is required.';
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (p.length > 128) return 'Password must be under 128 characters.';
  if (!/[A-Z]/.test(p)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(p)) return 'Password must include at least one lowercase letter.';
  if (!/\d/.test(p)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Password must include at least one special character (!@#$%^&* etc).';
  return null;
}

/** 4-digit security key used for password recovery (no email sending). */
export function validatePin(pin: unknown): string | null {
  const p = String(pin || '').trim();
  if (!p) return '4-digit key is required.';
  if (!/^\d{4}$/.test(p)) return 'Key must be exactly 4 digits.';
  return null;
}

export function validateName(name: unknown): string | null {
  const n = String(name || '').trim();
  if (n.length > 80) return 'Name must be under 80 characters.';
  return null;
}

export const PLAN_MAX_YEARS = 3;

/**
 * Validate a Pro expiration timestamp. Accepts null/undefined/'' (= perpetual).
 * Returns { error } or { iso } with the normalized ISO string.
 */
export function validatePlanExpiresAt(value: unknown): { error?: string; iso?: string | null } {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { iso: null };
  }
  const t = Date.parse(String(value));
  if (!Number.isFinite(t)) return { error: 'Expiration must be a valid date and time.' };
  if (t <= Date.now() + 60 * 1000) return { error: 'Expiration must be in the future.' };
  if (t > Date.now() + PLAN_MAX_YEARS * 365.25 * 86400000) {
    return { error: `Expiration cannot be more than ${PLAN_MAX_YEARS} years out.` };
  }
  return { iso: new Date(t).toISOString() };
}
