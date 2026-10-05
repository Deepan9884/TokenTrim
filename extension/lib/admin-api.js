/**
 * TokenTrim - Admin backend client (extension side).
 * Talks to the Creator Panel API (same surface in demo + Supabase modes).
 * Everything is opt-in and degrades gracefully:
 * - No admin URL configured → all calls no-op (local-first behavior kept).
 * - Offline / server down → events queue in an outbox, flushed later.
 * Session token lives in chrome.storage.local (never in page DOM).
 */

const URL_KEY = 'tokentrim_admin_url';
const TOKEN_KEY = 'tokentrim_admin_token';
const OUTBOX_KEY = 'tokentrim_event_outbox';
const CLOUD_SYNC_KEY = 'tokentrim_cloud_sync';
const OUTBOX_CAP = 200;

const memStorage = new Map();

function storage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch { /* ignore */ }
  return null;
}

async function storeGet(keys) {
  const s = storage();
  if (!s) {
    const arr = Array.isArray(keys) ? keys : [keys];
    const out = {};
    for (const k of arr) {
      if (memStorage.has(k)) out[k] = memStorage.get(k);
    }
    return out;
  }
  try {
    return await s.get(Array.isArray(keys) ? keys : [keys]);
  } catch {
    return {};
  }
}

async function storeSet(obj) {
  const s = storage();
  if (!s) {
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) memStorage.set(k, v);
    }
    return;
  }
  try {
    await s.set(obj);
  } catch { /* ignore */ }
}

export async function getBaseUrl() {
  const res = await storeGet(URL_KEY);
  const raw = String(res[URL_KEY] || '').trim().replace(/\/+$/, '');
  return raw || 'http://localhost:3100';
}

export async function setBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  if (clean) await storeSet({ [URL_KEY]: clean });
  else {
    const s = storage();
    if (s) { try { await s.remove([URL_KEY]); } catch { /* ignore */ } }
  }
  return clean || null;
}

export async function getToken() {
  const res = await storeGet(TOKEN_KEY);
  return res[TOKEN_KEY] || null;
}

async function setToken(token) {
  if (token) await storeSet({ [TOKEN_KEY]: token });
  else {
    const s = storage();
    if (s) { try { await s.remove([TOKEN_KEY]); } catch { /* ignore */ } }
  }
}

async function api(path, { method = 'GET', body = null, auth = true } = {}) {
  const base = await getBaseUrl();
  if (!base) {
    const err = new Error('NO_ADMIN_URL');
    err.code = 'NO_ADMIN_URL';
    throw err;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      cache: 'no-store'
    });
  } catch (e) {
    const err = new Error('ADMIN_UNREACHABLE');
    err.code = 'ADMIN_UNREACHABLE';
    err.cause = e;
    throw err;
  }
  let data = {};
  try {
    data = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.code = 'ADMIN_ERROR';
    err.status = res.status;
    throw err;
  }
  return data;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name || '',
    plan: u.plan || 'free', plan_expires_at: u.plan_expires_at || null,
    is_admin: !!u.is_admin,
    created_at: u.created_at, last_login_at: u.last_login_at || null
  };
}

export const AdminAPI = {
  getBaseUrl,
  setBaseUrl,
  getToken,
  setToken,

  async signup({ email, password, pin, name }) {
    const data = await api('/api/auth/signup', {
      method: 'POST', body: { email, password, pin, name, platform: 'extension' }, auth: false
    });
    // Server echoes the raw session token (cookies don't cross into
    // chrome-extension:// origins); the extension sends it as Bearer.
    if (data.token) await setToken(data.token);
    return publicUser(data.user);
  },

  async signin({ email, password }) {
    const data = await api('/api/auth/signin', {
      method: 'POST', body: { email, password, platform: 'extension' }, auth: false
    });
    if (data.token) await setToken(data.token);
    return publicUser(data.user);
  },

  async signout() {
    try {
      await api('/api/auth/signout', { method: 'POST' });
    } catch { /* ignore */ }
    await setToken(null);
  },

  async me() {
    try {
      const data = await api('/api/auth/me', { method: 'GET' });
      return publicUser(data.user);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        return null;
      }
      throw err;
    }
  },

  async forgot(email) {
    await api('/api/auth/forgot', { method: 'POST', body: { email }, auth: false });
    return true;
  },

  async reset({ email, pin, newPassword }) {
    const data = await api('/api/auth/reset', {
      method: 'POST', body: { email, pin, newPassword }, auth: false
    });
    if (data.token) await setToken(data.token);
    return publicUser(data.user);
  },

  /** Fire-and-forget event queue. Never throws. */
  async track(eventName, props = {}) {
    try {
      const res = await storeGet(OUTBOX_KEY);
      const outbox = Array.isArray(res[OUTBOX_KEY]) ? res[OUTBOX_KEY] : [];
      outbox.push({
        event_name: String(eventName),
        properties: props && typeof props === 'object' ? props : {},
        session_id: null,
        client_version: (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || null,
        platform: 'extension',
        at: Date.now()
      });
      await storeSet({ [OUTBOX_KEY]: outbox.slice(-OUTBOX_CAP) });
    } catch { /* ignore */ }
    void this.flush().catch(() => {});
  },

  /** POST queued events. Never throws. */
  async flush() {
    try {
      const base = await getBaseUrl();
      if (!base) return 0;
      const res = await storeGet(OUTBOX_KEY);
      const outbox = Array.isArray(res[OUTBOX_KEY]) ? res[OUTBOX_KEY] : [];
      if (!outbox.length) return 0;
      const batch = outbox.slice(0, 100);
      const token = await getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(base + '/api/events', {
        method: 'POST', headers, body: JSON.stringify({ events: batch })
      });
      if (!r.ok) return 0;
      await storeSet({ [OUTBOX_KEY]: outbox.slice(batch.length) });
      return batch.length;
    } catch {
      return 0;
    }
  },

  /** Check if cloud document sync is enabled */
  async isCloudSyncEnabled() {
    const res = await storeGet(CLOUD_SYNC_KEY);
    return res[CLOUD_SYNC_KEY] !== false;
  },

  /** Set cloud document sync preference */
  async setCloudSyncEnabled(enabled) {
    await storeSet({ [CLOUD_SYNC_KEY]: !!enabled });
  },

  /** Save/sync document to cloud database. Degrades gracefully if offline/unauthed. */
  async saveDocument(doc) {
    try {
      const token = await getToken();
      if (!token) return null;
      const data = await api('/api/documents', {
        method: 'POST',
        body: {
          id: doc.id,
          title: doc.title,
          preset: doc.preset || 'claude',
          markdown: doc.markdown,
          chunks: doc.chunks || [],
          pages: doc.pages || 0,
          tokens: doc.tokens || 0,
          source_type: doc.sourceType || doc.source_type || 'pdf'
        },
        auth: true
      });
      return data?.id || null;
    } catch {
      return null;
    }
  },

  /** List user documents from cloud database */
  async listDocuments(limit = 20) {
    try {
      const token = await getToken();
      if (!token) return [];
      const data = await api(`/api/documents?limit=${limit}`, { method: 'GET', auth: true });
      return Array.isArray(data?.documents) ? data.documents : [];
    } catch {
      return [];
    }
  },

  /** Fetch a single document with full markdown & chunks from cloud */
  async getDocument(id) {
    try {
      const token = await getToken();
      if (!token) return null;
      const data = await api(`/api/documents/${encodeURIComponent(id)}`, { method: 'GET', auth: true });
      return data?.document || null;
    } catch {
      return null;
    }
  },

  /** Delete a document from cloud database */
  async deleteDocument(id) {
    try {
      const token = await getToken();
      if (!token) return false;
      const data = await api(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
      return !!data?.deleted;
    } catch {
      return false;
    }
  }
};

export default AdminAPI;
