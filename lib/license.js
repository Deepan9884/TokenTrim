/**
 * TokenTrim - License (local-only Pro gating)
 * Free: 50MB, single-file, standard modes. Pro unlocks batch/OCR/200MB/history.
 * No server calls. License key validated locally; optional expires_at
 * (ISO string) lapses the key automatically. Server-granted plans arrive
 * via AdminAPI.me() and are enforced in popup.js.
 */

const LICENSE_KEY = 'tokentrim_license';
const PRO_KEY_PREFIX = 'TT-PRO-';
const PRO_KEY_PATTERN = /^TT-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function isValidProKey(key) {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim().toUpperCase();
  if (!PRO_KEY_PATTERN.test(clean)) return false;
  // Prevent trivial repeating character bypasses (e.g. TT-PRO-0000-0000-0000)
  const body = clean.slice(7).replace(/-/g, '');
  const unique = new Set(body);
  if (unique.size < 4) return false;
  return true;
}

function storage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return chrome.storage.local;
  } catch { /* ignore */ }
  return null;
}

export const PLAN_LIMITS = {
  free: { maxMB: 50, batch: false, ocr: false, history: false, budgets: [4000, 8000], maxPptSlides: 10, allowImage: false },
  pro: { maxMB: 200, batch: true, ocr: true, history: true, budgets: [4000, 8000, 16000, 32000, 0], maxPptSlides: Infinity, allowImage: true }
};

export const License = {
  plan: 'free',
  key: null,
  expiresAt: null,

  async init() {
    const s = storage();
    if (!s) { this.plan = 'free'; return this.plan; }
    try {
      const res = await s.get([LICENSE_KEY]);
      const val = res[LICENSE_KEY];
      if (val && typeof val.key === 'string' && isValidProKey(val.key)) {
        const exp = typeof val.expires_at === 'string' ? Date.parse(val.expires_at) : NaN;
        if (Number.isFinite(exp) && exp <= Date.now()) {
          // Lapsed key: drop it so Free limits apply immediately.
          try { await s.remove([LICENSE_KEY]); } catch { /* ignore */ }
          this.plan = 'free';
          this.key = null;
          this.expiresAt = null;
        } else {
          this.plan = 'pro';
          this.key = val.key;
          this.expiresAt = Number.isFinite(exp) ? val.expires_at : null;
        }
      } else {
        this.plan = 'free';
        this.key = null;
        this.expiresAt = null;
      }
    } catch { this.plan = 'free'; }
    return this.plan;
  },

  isPro() {
    if (this.plan !== 'pro') return false;
    if (!this.expiresAt) return true;
    const t = Date.parse(this.expiresAt);
    return Number.isFinite(t) && t > Date.now();
  },

  isFormatAllowed(sourceType) {
    if (sourceType === 'image') return this.isPro();
    return true;
  },

  maxPptSlides() {
    return this.isPro() ? Infinity : 10;
  },

  limits() { return this.isPro() ? PLAN_LIMITS.pro : PLAN_LIMITS.free; },

  maxBytes() { return this.limits().maxMB * 1024 * 1024; },

  async activate(key, expiresAt = null) {
    const clean = String(key || '').trim().toUpperCase();
    if (!isValidProKey(clean)) {
      throw new Error('INVALID_LICENSE');
    }
    let expIso = null;
    if (expiresAt != null && String(expiresAt).trim() !== '') {
      const t = Date.parse(String(expiresAt));
      if (!Number.isFinite(t) || t <= Date.now()) throw new Error('LICENSE_EXPIRED');
      expIso = new Date(t).toISOString();
    }
    const s = storage();
    if (s) { try { await s.set({ [LICENSE_KEY]: { key: clean, at: Date.now(), expires_at: expIso } }); } catch { /* ignore */ } }
    this.plan = 'pro';
    this.key = clean;
    this.expiresAt = expIso;
    return true;
  },

  async deactivate() {
    const s = storage();
    if (s) { try { await s.remove([LICENSE_KEY]); } catch { /* ignore */ } }
    this.plan = 'free';
    this.key = null;
    this.expiresAt = null;
    return true;
  }
};

export default License;
