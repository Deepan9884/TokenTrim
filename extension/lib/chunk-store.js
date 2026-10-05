/**
 * TokenTrim - ChunkStore (IndexedDB, local only)
 * Stores recent documents + chunks for retrieval without re-pasting.
 */

import { AdminAPI } from './admin-api.js';

const DB_NAME = 'tokentrim';
const DB_VERSION = 1;
const DOC_STORE = 'documents';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        const store = db.createObjectStore(DOC_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function newId() {
  return 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function detectTypeFromTitle(title) {
  const t = String(title || '').toLowerCase();
  if (t.endsWith('.pptx') || t.endsWith('.ppt')) return 'pptx';
  if (t.endsWith('.docx')) return 'docx';
  if (t.endsWith('.xlsx') || t.endsWith('.xls')) return 'xlsx';
  if (t.endsWith('.csv') || t.endsWith('.tsv')) return 'csv';
  if (t.endsWith('.png') || t.endsWith('.jpg') || t.endsWith('.jpeg') || t.endsWith('.webp') || t.endsWith('.gif')) return 'image';
  if (t.endsWith('.epub')) return 'epub';
  if (t.endsWith('.html') || t.endsWith('.htm')) return 'html';
  if (t.endsWith('.txt') || t.endsWith('.md')) return 'text';
  return 'pdf';
}

function chunkText(markdown, maxChars = 2000) {
  const paras = String(markdown || '').split(/\n{2,}/);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > maxChars) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = p;
    } else {
      cur += (cur ? '\n\n' : '') + p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, 200);
}

export const ChunkStore = {
  async saveDocument({ title, markdown, preset = 'claude', meta = {} }) {
    const db = await openDb();
    const chunks = chunkText(markdown);
    const rec = {
      id: newId(),
      title: String(title || 'document').slice(0, 120),
      preset,
      markdown: String(markdown || '').slice(0, 500000),
      chunks,
      pages: meta.pages || 0,
      tokens: meta.tokens || 0,
      sourceType: meta.sourceType || detectTypeFromTitle(title),
      createdAt: Date.now()
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    try { db.close(); } catch { /* ignore */ }

    // Opportunistic cloud sync to Supabase if signed in & enabled
    try {
      if (typeof AdminAPI !== 'undefined') {
        const syncOn = await AdminAPI.isCloudSyncEnabled().catch(() => false);
        if (syncOn) {
          void AdminAPI.saveDocument(rec).catch(() => {});
        }
      }
    } catch { /* ignore */ }

    return rec.id;
  },

  async listDocuments(limit = 20) {
    const db = await openDb();
    const out = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readonly');
      const store = tx.objectStore(DOC_STORE);
      const idx = store.index('createdAt');
      const req = idx.openCursor(null, 'prev');
      const rows = [];
      req.onsuccess = () => {
        const cur = req.result;
        if (cur && rows.length < limit) {
          const v = cur.value;
          rows.push({ id: v.id, title: v.title, preset: v.preset, pages: v.pages, tokens: v.tokens, sourceType: v.sourceType || detectTypeFromTitle(v.title), createdAt: v.createdAt, chunkCount: (v.chunks || []).length });
          cur.continue();
        } else resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
    try { db.close(); } catch { /* ignore */ }

    // If signed in, merge any cloud documents from Supabase not in local DB
    try {
      if (typeof AdminAPI !== 'undefined') {
        const syncOn = await AdminAPI.isCloudSyncEnabled().catch(() => false);
        if (syncOn) {
          const cloudDocs = await AdminAPI.listDocuments(limit).catch(() => []);
          if (cloudDocs && cloudDocs.length) {
            const localIds = new Set(out.map(d => d.id));
            for (const cd of cloudDocs) {
              if (!localIds.has(cd.id)) {
                out.push({ ...cd, isCloud: true });
              }
            }
            out.sort((a, b) => b.createdAt - a.createdAt);
          }
        }
      }
    } catch { /* ignore */ }

    return out.slice(0, limit);
  },

  async getDocument(id) {
    let rec = null;
    try {
      const db = await openDb();
      rec = await new Promise((resolve, reject) => {
        const tx = db.transaction(DOC_STORE, 'readonly');
        const req = tx.objectStore(DOC_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      try { db.close(); } catch { /* ignore */ }
    } catch { /* ignore */ }

    // Fall back to cloud database if document not stored locally
    if (!rec) {
      try {
        if (typeof AdminAPI !== 'undefined') {
          rec = await AdminAPI.getDocument(id).catch(() => null);
        }
      } catch { /* ignore */ }
    }
    return rec;
  },

  async deleteDocument(id) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DOC_STORE, 'readwrite');
        tx.objectStore(DOC_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      try { db.close(); } catch { /* ignore */ }
    } catch { /* ignore */ }

    // Delete from cloud database if connected
    try {
      if (typeof AdminAPI !== 'undefined') {
        void AdminAPI.deleteDocument(id).catch(() => {});
      }
    } catch { /* ignore */ }

    return true;
  },

  async clearAll() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, 'readwrite');
      tx.objectStore(DOC_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    try { db.close(); } catch { /* ignore */ }
    return true;
  }
};

export default ChunkStore;
