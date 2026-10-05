/**
 * TokenTrim - Privacy-preserving telemetry (opt-in, event names + aggregates only).
 * NEVER records: document content, filenames, URLs, page text, clipboard.
 */

const ENABLE_KEY = 'tokentrim_telemetry_enabled';
const COUNTS_KEY = 'tokentrim_telemetry_counts';

const ALLOWED_EVENTS = new Set([
  'file_select', 'convert_start', 'convert_success', 'convert_error',
  'copy', 'download', 'prompt_pack_copy', 'batch_start', 'batch_complete',
  'ocr_used', 'preset_changed', 'feedback_sent', 'onboarding_complete'
]);

function storage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch { /* ignore */ }
  return null;
}

export const Telemetry = {
  enabled: false,

  async init() {
    const s = storage();
    if (!s) { this.enabled = false; return false; }
    try {
      const res = await s.get([ENABLE_KEY]);
      this.enabled = !!res[ENABLE_KEY];
      return this.enabled;
    } catch {
      this.enabled = false;
      return false;
    }
  },

  async setEnabled(on) {
    this.enabled = !!on;
    const s = storage();
    if (s) {
      try { await s.set({ [ENABLE_KEY]: this.enabled }); } catch { /* ignore */ }
    }
    return this.enabled;
  },

  async isEnabled() {
    if (this.enabled) return true;
    return await this.init();
  },

  sanitizeProps(props = {}) {
    // Allow only numeric/boolean aggregates and whitelisted enums.
    const out = {};
    if (typeof props.pages === 'number') out.pages = Math.min(9999, Math.round(props.pages));
    if (typeof props.tokens === 'number') out.tokens = Math.round(props.tokens);
    if (typeof props.ms === 'number') out.ms = Math.round(props.ms);
    if (typeof props.preset === 'string' && /^[a-z]{2,12}$/.test(props.preset)) out.preset = props.preset;
    if (typeof props.mode === 'string' && /^[a-z]{2,16}$/.test(props.mode)) out.mode = props.mode;
    if (typeof props.errorCode === 'string' && /^[A-Z_]{2,32}$/.test(props.errorCode)) out.errorCode = props.errorCode;
    return out;
  },

  async track(event, props = {}) {
    if (!ALLOWED_EVENTS.has(event)) return false;
    if (!(await this.isEnabled())) return false;
    const s = storage();
    if (!s) return false;
    try {
      const res = await s.get([COUNTS_KEY]);
      const counts = res[COUNTS_KEY] || {};
      counts[event] = (counts[event] || 0) + 1;
      await s.set({ [COUNTS_KEY]: counts });
    } catch { /* ignore */ }
    try { console.log('[TokenTrim][telemetry]', event, this.sanitizeProps(props)); } catch { /* ignore */ }
    return true;
  },

  async getCounts() {
    const s = storage();
    if (!s) return {};
    try {
      const res = await s.get([COUNTS_KEY]);
      return res[COUNTS_KEY] || {};
    } catch { return {}; }
  }
};

export default Telemetry;
