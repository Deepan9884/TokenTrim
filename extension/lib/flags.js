/**
 * TokenTrim - Feature flags (chrome.storage.local backed, defaults off for beta).
 */

export const FLAG_DEFAULTS = {
  extractiveCompression: true,
  queryAware: true,
  ocrEnabled: false,
  batchConversion: true,
  sidePanel: true,
  telemetryEnabled: false,
  promptPack: true,
  historyEnabled: true
};

const STORAGE_KEY = 'tokentrim_flags';

function storage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch { /* ignore */ }
  return null;
}

export const FeatureFlags = {
  defaults: FLAG_DEFAULTS,

  async load() {
    const s = storage();
    if (!s) return { ...FLAG_DEFAULTS };
    try {
      const res = await s.get([STORAGE_KEY]);
      return { ...FLAG_DEFAULTS, ...(res[STORAGE_KEY] || {}) };
    } catch {
      return { ...FLAG_DEFAULTS };
    }
  },

  async save(flags) {
    const s = storage();
    if (!s) return flags;
    const merged = { ...FLAG_DEFAULTS, ...flags };
    try { await s.set({ [STORAGE_KEY]: merged }); } catch { /* ignore */ }
    return merged;
  },

  async isEnabled(name) {
    const all = await this.load();
    return !!all[name];
  }
};

export default FeatureFlags;
