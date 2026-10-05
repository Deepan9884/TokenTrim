/**
 * Data layer: one interface, two backends.
 * - Demo store (default): local JSON file, zero setup — used for local dev
 *   and Playwright verification.
 * - Supabase store: used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 * Auth (password + 4-digit PIN) is implemented here so both modes behave
 * identically. No email is ever sent (per requirements).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashSecret, verifySecret, newSessionToken, newSalt, sha256 } from './crypto';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  /** ISO timestamp when a Pro grant lapses. Null = perpetual (or not Pro). Optional so old rows still parse. */
  plan_expires_at?: string | null;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  // Security posture (single-browser enforcement). Optional so old rows still parse.
  force_reauth?: boolean;
  active_sessions?: number;
  current_device?: string | null;
  current_ip?: string | null;
  current_started_at?: string | null;
}

export interface StoredUser extends PublicUser {
  password_hash: string;
  pin_hash: string;
  failed_pin_attempts?: number;
  last_failed_pin_at?: string | null;
  pin_locked_until?: string | null;
}

export interface SessionInfo {
  token_hash: string;
  user_id: string;
  device: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface SessionMeta {
  device?: string | null;
  ip?: string | null;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SecurityOverview {
  activeSessions: number;
  revoked7d: number;
  failedPin7d: number;
  forceReauthCount: number;
}

export interface EventRow {
  id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string | null;
  client_version: string | null;
  platform: string | null;
  created_at: string;
}

export interface UserAggregate {
  conversions: number;
  tokensSaved: number;
  events: number;
  uploads: number;
  uploadsByType: Record<string, number>;
  conversionsByType: Record<string, number>;
  lastSeen: string | null;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  title: string;
  preset: string;
  markdown: string;
  chunks: string[];
  pages: number;
  tokens: number;
  source_type?: string;
  ocr_used?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentInput {
  id?: string;
  title: string;
  preset?: string;
  markdown: string;
  chunks?: string[];
  pages?: number;
  tokens?: number;
  source_type?: string;
  ocr_used?: boolean;
  createdAt?: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  preset: string;
  pages: number;
  tokens: number;
  source_type: string;
  createdAt: number;
  chunkCount: number;
}

export type SessionStatus = 'active' | 'revoked_concurrent' | 'revoked_admin' | 'expired' | 'invalid';

export interface SessionStatusResult {
  user: PublicUser | null;
  status: SessionStatus;
}

export interface Store {
  readonly name: 'demo' | 'supabase';
  createUser(input: { email: string; name: string; password: string; pin: string; isAdmin?: boolean; createdAt?: string }): Promise<PublicUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  verifyPin(user: StoredUser, pin: string): boolean;
  touchLogin(userId: string): Promise<void>;
  createSession(userId: string, meta?: SessionMeta): Promise<string>;
  getSessionUser(token: string): Promise<PublicUser | null>;
  getSessionUserWithStatus(token: string): Promise<SessionStatusResult>;
  deleteSession(token: string): Promise<void>;
  // Single-browser enforcement + admin security controls
  listUserSessions(userId: string): Promise<SessionInfo[]>;
  revokeUserSessions(userId: string, reason?: string): Promise<number>;
  setUserPlan(userId: string, plan: string, expiresAt?: string | null): Promise<void>;
  resetUserPin(userId: string, newPin: string): Promise<void>;
  setForceReauth(userId: string, value: boolean): Promise<void>;
  recordFailedPin(userId: string): Promise<void>;
  clearFailedPin(userId: string): Promise<void>;
  appendAuditLog(entry: { admin_id: string | null; action: string; target_user_id?: string | null; details?: Record<string, unknown>; ip?: string | null; user_agent?: string | null }): Promise<void>;
  listAuditLog(limit?: number): Promise<AuditLogEntry[]>;
  securityOverview(): Promise<SecurityOverview>;
  insertEvents(rows: Array<Omit<EventRow, 'id' | 'created_at'> & { created_at?: string }>): Promise<number>;
  listUsers(): Promise<StoredUser[]>;
  listEvents(opts: { limit: number; event?: string; userId?: string; q?: string }): Promise<EventRow[]>;
  aggregates(): Promise<Map<string, UserAggregate>>;
  saveUserDocument(userId: string, doc: DocumentInput): Promise<string>;
  listUserDocuments(userId: string, limit?: number): Promise<DocumentSummary[]>;
  getUserDocument(userId: string, docId: string): Promise<DocumentRow | null>;
  deleteUserDocument(userId: string, docId: string): Promise<boolean>;
  resetForTests(): Promise<void>;
}

export function toPublic(u: StoredUser): PublicUser {
  const { password_hash: _p, pin_hash: _k, failed_pin_attempts: _f, last_failed_pin_at: _l, pin_locked_until: _q, ...rest } = u;
  void _p; void _k; void _f; void _l; void _q;
  return {
    ...rest,
    force_reauth: !!u.force_reauth,
    active_sessions: u.active_sessions ?? undefined,
    current_device: u.current_device ?? null,
    current_ip: u.current_ip ?? null,
    current_started_at: u.current_started_at ?? null
  };
}

const UPLOAD_EVENTS = new Set(['file_select', 'upload_start', 'upload_complete', 'convert_start']);
const CONVERT_EVENTS = new Set(['convert_success']);

function bumpType(map: Record<string, number>, raw: unknown): void {
  const s = normalizeSourceType(raw);
  map[s] = (map[s] || 0) + 1;
}

export function emptyAggregate(): UserAggregate {
  return { conversions: 0, tokensSaved: 0, events: 0, uploads: 0, uploadsByType: {}, conversionsByType: {}, lastSeen: null };
}

const VALID_SOURCE_TYPES = new Set(['pdf', 'docx', 'pptx', 'image', 'xlsx', 'csv', 'text', 'html', 'epub', 'other']);

export function normalizeSourceType(v: unknown): string {
  const s = String(v || '').toLowerCase().trim();
  if (VALID_SOURCE_TYPES.has(s)) return s;
  // legacy / fuzzy
  if (s === 'ppt' || s === 'presentation') return 'pptx';
  if (s === 'doc' || s === 'word') return 'docx';
  if (s === 'xls' || s === 'sheet' || s === 'spreadsheet') return 'xlsx';
  if (s === 'img' || s === 'photo' || s.startsWith('image')) return 'image';
  if (!s) return 'pdf';
  return 'other';
}

// ---------------------------------------------------------------------------
// Demo store (JSON file)
// ---------------------------------------------------------------------------

interface DemoSession {
  token_hash: string;
  user_id: string;
  device: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

interface DemoDb {
  users: StoredUser[];
  sessions: DemoSession[];
  events: EventRow[];
  documents?: DocumentRow[];
  audit?: AuditLogEntry[];
}

const SESSION_DAYS = 30;

function demoPath(): string {
  if (process.env.DEMO_DB_PATH) return process.env.DEMO_DB_PATH;
  return join(process.cwd(), 'data', 'demo-db.json');
}

function loadDb(): DemoDb {
  const p = demoPath();
  try {
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<DemoDb>;
      const sessions: DemoSession[] = (raw.sessions || []).map((s) => ({
        token_hash: (s as DemoSession).token_hash,
        user_id: (s as DemoSession).user_id,
        device: (s as DemoSession).device ?? null,
        ip: (s as DemoSession).ip ?? null,
        created_at: (s as DemoSession).created_at,
        expires_at: (s as DemoSession).expires_at,
        revoked_at: (s as DemoSession).revoked_at ?? null,
        revoke_reason: (s as DemoSession).revoke_reason ?? null
      }));
      const users: StoredUser[] = (raw.users || []).map((u) => ({
        force_reauth: false,
        failed_pin_attempts: 0,
        last_failed_pin_at: null,
        pin_locked_until: null,
        plan_expires_at: null,
        ...u
      })) as StoredUser[];
      return { users, sessions, events: raw.events || [], documents: raw.documents || [], audit: raw.audit || [] };
    }
  } catch { /* corrupt file → reseed below */ }
  const db: DemoDb = { users: [], sessions: [], events: [], documents: [], audit: [] };
  if (process.env.SEED_ADMIN !== 'false') {
    const now = new Date().toISOString();
    db.users.push({
      id: randomUUID(),
      email: process.env.ADMIN_EMAIL || 'admin@tokentrim.local',
      name: 'Creator',
      plan: 'pro',
      plan_expires_at: null,
      is_admin: true,
      created_at: now,
      last_login_at: null,
      password_hash: hashSecret(process.env.ADMIN_PASSWORD || 'admin123', newSalt()),
      pin_hash: hashSecret(process.env.ADMIN_PIN || '1234', newSalt()),
      force_reauth: false,
      failed_pin_attempts: 0,
      last_failed_pin_at: null,
      pin_locked_until: null
    });
  }
  saveDb(db);
  return db;
}

function saveDb(db: DemoDb): void {
  const p = demoPath();
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify(db));
}

class DemoStore implements Store {
  readonly name = 'demo' as const;

  async createUser(input: { email: string; name: string; password: string; pin: string; isAdmin?: boolean; createdAt?: string }): Promise<PublicUser> {
    const db = loadDb();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) {
      const err = new Error('An account with this email already exists.');
      (err as NodeJS.ErrnoException).code = 'EXISTS';
      throw err;
    }
    const now = input.createdAt || new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      plan: 'free',
      plan_expires_at: null,
      is_admin: !!input.isAdmin,
      created_at: now,
      last_login_at: now,
      password_hash: hashSecret(input.password, newSalt()),
      pin_hash: hashSecret(input.pin, newSalt()),
      force_reauth: false,
      failed_pin_attempts: 0,
      last_failed_pin_at: null,
      pin_locked_until: null,
      current_device: null,
      current_ip: null,
      current_started_at: null
    };
    db.users.push(user);
    saveDb(db);
    return toPublic(user);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const e = email.trim().toLowerCase();
    return loadDb().users.find((u) => u.email === e) || null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === id) || null;
    if (!u) return null;
    const now = Date.now();
    const active = db.sessions.filter(
      (s) => s.user_id === id && !s.revoked_at && Date.parse(s.expires_at) > now
    );
    const current = active.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      ...u,
      active_sessions: active.length,
      current_device: current?.device ?? u.current_device ?? null,
      current_ip: current?.ip ?? u.current_ip ?? null,
      current_started_at: current?.created_at ?? u.current_started_at ?? null
    };
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found.');
    u.password_hash = hashSecret(newPassword, newSalt());
    saveDb(db);
  }

  verifyPin(user: StoredUser, pin: string): boolean {
    if (user.pin_locked_until && Date.parse(user.pin_locked_until) > Date.now()) return false;
    return verifySecret(pin.trim(), user.pin_hash);
  }

  async touchLogin(userId: string): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (u) { u.last_login_at = new Date().toISOString(); saveDb(db); }
  }

  async createSession(userId: string, meta?: SessionMeta): Promise<string> {
    const db = loadDb();
    const token = newSessionToken();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    // SINGLE-BROWSER ENFORCEMENT: revoke every other live session for this user.
    for (const s of db.sessions) {
      if (s.user_id === userId && !s.revoked_at && Date.parse(s.expires_at) > now) {
        s.revoked_at = nowIso;
        s.revoke_reason = 'new_login';
      }
    }
    // prune expired + old revoked (keep last 200 for audit)
    db.sessions = db.sessions.filter((s) => {
      if (Date.parse(s.expires_at) <= now && s.revoked_at) return false;
      if (Date.parse(s.expires_at) <= now - 7 * 86400000) return false;
      return true;
    }).slice(-5000);
    db.sessions.push({
      token_hash: sha256(token),
      user_id: userId,
      device: (meta?.device || '').slice(0, 120) || null,
      ip: (meta?.ip || '').slice(0, 64) || null,
      created_at: nowIso,
      expires_at: new Date(now + SESSION_DAYS * 86400000).toISOString(),
      revoked_at: null,
      revoke_reason: null
    });
    const u = db.users.find((x) => x.id === userId);
    if (u) {
      u.force_reauth = false;
      u.current_device = (meta?.device || '').slice(0, 120) || null;
      u.current_ip = (meta?.ip || '').slice(0, 64) || null;
      u.current_started_at = nowIso;
      u.last_login_at = nowIso;
    }
    saveDb(db);
    return token;
  }

  async getSessionUserWithStatus(token: string): Promise<SessionStatusResult> {
    if (!token) return { user: null, status: 'invalid' };
    const db = loadDb();
    const s = db.sessions.find((x) => x.token_hash === sha256(token));
    if (!s) return { user: null, status: 'invalid' };
    if (s.revoked_at) {
      if (s.revoke_reason === 'new_login') return { user: null, status: 'revoked_concurrent' };
      if (s.revoke_reason === 'admin_revoke') return { user: null, status: 'revoked_admin' };
      return { user: null, status: 'invalid' };
    }
    if (Date.parse(s.expires_at) <= Date.now()) return { user: null, status: 'expired' };
    const u = db.users.find((x) => x.id === s.user_id);
    if (!u || u.force_reauth) return { user: null, status: 'invalid' };
    const active = db.sessions.filter(
      (x) => x.user_id === u.id && !x.revoked_at && Date.parse(x.expires_at) > Date.now()
    );
    const user = { ...toPublic(u), active_sessions: active.length, current_device: s.device, current_ip: s.ip, current_started_at: s.created_at };
    return { user, status: 'active' };
  }

  async getSessionUser(token: string): Promise<PublicUser | null> {
    const res = await this.getSessionUserWithStatus(token);
    return res.user;
  }

  async deleteSession(token: string): Promise<void> {
    const db = loadDb();
    const h = sha256(token);
    const s = db.sessions.find((x) => x.token_hash === h);
    if (s && !s.revoked_at) {
      s.revoked_at = new Date().toISOString();
      s.revoke_reason = 'signout';
    } else {
      db.sessions = db.sessions.filter((x) => x.token_hash !== h);
    }
    saveDb(db);
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const db = loadDb();
    return db.sessions
      .filter((s) => s.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 50)
      .map((s) => ({ ...s }));
  }

  async revokeUserSessions(userId: string, reason = 'admin_revoke'): Promise<number> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    let n = 0;
    for (const s of db.sessions) {
      if (s.user_id === userId && !s.revoked_at) {
        s.revoked_at = nowIso;
        s.revoke_reason = reason;
        n += 1;
      }
    }
    const u = db.users.find((x) => x.id === userId);
    if (u) {
      u.force_reauth = true;
      u.current_device = null;
      u.current_ip = null;
      u.current_started_at = null;
    }
    saveDb(db);
    return n;
  }

  async setUserPlan(userId: string, plan: string, expiresAt?: string | null): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found.');
    const p = String(plan || '').toLowerCase().trim();
    if (!['free', 'pro'].includes(p)) throw new Error('Invalid plan.');
    u.plan = p;
    // Free clears any expiry; Pro keeps the given expiry (null = perpetual).
    u.plan_expires_at = p === 'pro' ? (expiresAt ?? null) : null;
    saveDb(db);
  }

  async resetUserPin(userId: string, newPin: string): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found.');
    if (!/^\d{4}$/.test(String(newPin || '').trim())) throw new Error('Key must be exactly 4 digits.');
    u.pin_hash = hashSecret(String(newPin).trim(), newSalt());
    u.failed_pin_attempts = 0;
    u.last_failed_pin_at = null;
    u.pin_locked_until = null;
    saveDb(db);
  }

  async setForceReauth(userId: string, value: boolean): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found.');
    u.force_reauth = value;
    saveDb(db);
  }

  async recordFailedPin(userId: string): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    const n = (u.failed_pin_attempts || 0) + 1;
    u.failed_pin_attempts = n;
    u.last_failed_pin_at = new Date().toISOString();
    if (n >= 5) u.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    saveDb(db);
  }

  async clearFailedPin(userId: string): Promise<void> {
    const db = loadDb();
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.failed_pin_attempts = 0;
    u.last_failed_pin_at = null;
    u.pin_locked_until = null;
    saveDb(db);
  }

  async appendAuditLog(entry: { admin_id: string | null; action: string; target_user_id?: string | null; details?: Record<string, unknown>; ip?: string | null; user_agent?: string | null }): Promise<void> {
    const db = loadDb();
    if (!db.audit) db.audit = [];
    db.audit.push({
      id: randomUUID(),
      admin_id: entry.admin_id,
      action: String(entry.action || '').slice(0, 80),
      target_user_id: entry.target_user_id || null,
      details: entry.details && typeof entry.details === 'object' ? entry.details : {},
      ip: entry.ip || null,
      user_agent: (entry.user_agent || '').slice(0, 200) || null,
      created_at: new Date().toISOString()
    });
    if (db.audit.length > 2000) db.audit = db.audit.slice(db.audit.length - 2000);
    saveDb(db);
  }

  async listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const db = loadDb();
    const lim = Math.max(1, Math.min(500, limit));
    return [...(db.audit || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, lim);
  }

  async securityOverview(): Promise<SecurityOverview> {
    const db = loadDb();
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const activeSessions = db.sessions.filter((s) => !s.revoked_at && Date.parse(s.expires_at) > now).length;
    const revoked7d = db.sessions.filter((s) => s.revoked_at && Date.parse(s.revoked_at) >= weekAgo).length;
    let failedPin7d = 0;
    for (const u of db.users) {
      if (u.last_failed_pin_at && Date.parse(u.last_failed_pin_at) >= weekAgo) failedPin7d += (u.failed_pin_attempts || 0);
    }
    // also count security_pin_failed events in last 7d
    for (const e of db.events) {
      if (e.event_name === 'security_pin_failed' && Date.parse(e.created_at) >= weekAgo) failedPin7d += 1;
    }
    const forceReauthCount = db.users.filter((u) => u.force_reauth).length;
    return { activeSessions, revoked7d, failedPin7d, forceReauthCount };
  }

  async insertEvents(rows: Array<Omit<EventRow, 'id' | 'created_at'> & { created_at?: string }>): Promise<number> {
    const db = loadDb();
    const now = new Date().toISOString();
    for (const r of rows.slice(0, 500)) {
      db.events.push({
        id: randomUUID(),
        user_id: r.user_id,
        event_name: r.event_name,
        properties: r.properties && typeof r.properties === 'object' ? r.properties : {},
        session_id: r.session_id ?? null,
        client_version: r.client_version ?? null,
        platform: r.platform ?? null,
        created_at: r.created_at || now
      });
    }
    // cap demo DB size
    if (db.events.length > 20000) db.events = db.events.slice(db.events.length - 20000);
    saveDb(db);
    return Math.min(rows.length, 500);
  }

  async listUsers(): Promise<StoredUser[]> {
    return [...loadDb().users].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async listEvents(opts: { limit: number; event?: string; userId?: string; q?: string }): Promise<EventRow[]> {
    const limit = Math.max(1, Math.min(20000, opts.limit || 100));
    const q = (opts.q || '').trim().toLowerCase();
    const rows = loadDb().events.filter((e) => {
      if (opts.event && e.event_name !== opts.event) return false;
      if (opts.userId && e.user_id !== opts.userId) return false;
      if (q && !JSON.stringify(e.properties).toLowerCase().includes(q) && !(e.event_name || '').includes(q)) return false;
      return true;
    });
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }

  async aggregates(): Promise<Map<string, UserAggregate>> {
    const map = new Map<string, UserAggregate>();
    for (const e of loadDb().events) {
      if (!e.user_id) continue;
      let a = map.get(e.user_id);
      if (!a) { a = emptyAggregate(); map.set(e.user_id, a); }
      a.events += 1;
      if (!a.lastSeen || e.created_at > a.lastSeen) a.lastSeen = e.created_at;
      if (UPLOAD_EVENTS.has(e.event_name)) {
        a.uploads += 1;
        bumpType(a.uploadsByType, (e.properties as Record<string, unknown>)?.source_type);
      }
      if (CONVERT_EVENTS.has(e.event_name)) {
        a.conversions += 1;
        const t = (e.properties as Record<string, unknown>)?.tokens_saved;
        if (typeof t === 'number' && Number.isFinite(t)) a.tokensSaved += Math.round(t);
        bumpType(a.conversionsByType, (e.properties as Record<string, unknown>)?.source_type);
      }
    }
    for (const a of map.values()) {
      if (a.uploads < a.conversions) a.uploads = a.conversions;
      for (const [k, v] of Object.entries(a.conversionsByType)) {
        if (!a.uploadsByType[k] || a.uploadsByType[k] < v) a.uploadsByType[k] = v;
      }
    }
    return map;
  }

  async saveUserDocument(userId: string, doc: DocumentInput): Promise<string> {
    const db = loadDb();
    if (!db.documents) db.documents = [];
    const id = doc.id || ('doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
    const now = doc.createdAt || new Date().toISOString();
    const existingIdx = db.documents.findIndex(d => d.id === id && d.user_id === userId);
    const row: DocumentRow = {
      id,
      user_id: userId,
      title: String(doc.title || 'document').slice(0, 120),
      preset: doc.preset || 'claude',
      markdown: String(doc.markdown || ''),
      chunks: Array.isArray(doc.chunks) ? doc.chunks : [],
      pages: doc.pages || 0,
      tokens: doc.tokens || 0,
      source_type: normalizeSourceType(doc.source_type),
      ocr_used: !!doc.ocr_used,
      created_at: now,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      db.documents[existingIdx] = row;
    } else {
      db.documents.push(row);
    }
    saveDb(db);
    return id;
  }

  async listUserDocuments(userId: string, limit = 20): Promise<DocumentSummary[]> {
    const db = loadDb();
    const docs = (db.documents || []).filter(d => d.user_id === userId);
    docs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return docs.slice(0, Math.max(1, Math.min(100, limit))).map(d => ({
      id: d.id,
      title: d.title,
      preset: d.preset,
      pages: d.pages,
      tokens: d.tokens,
      source_type: (d as DocumentRow).source_type || 'pdf',
      createdAt: Date.parse(d.created_at) || Date.now(),
      chunkCount: d.chunks?.length || 0
    }));
  }

  async getUserDocument(userId: string, docId: string): Promise<DocumentRow | null> {
    const db = loadDb();
    const found = (db.documents || []).find(d => d.id === docId && d.user_id === userId);
    return found || null;
  }

  async deleteUserDocument(userId: string, docId: string): Promise<boolean> {
    const db = loadDb();
    const initialLen = (db.documents || []).length;
    db.documents = (db.documents || []).filter(d => !(d.id === docId && d.user_id === userId));
    saveDb(db);
    return db.documents.length < initialLen;
  }

  async resetForTests(): Promise<void> {
    saveDb({ users: [], sessions: [], events: [], documents: [], audit: [] });
  }
}

// ---------------------------------------------------------------------------
// Supabase store (Postgres via service role; same behavior as demo)
// ---------------------------------------------------------------------------

async function supabaseAdmin() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' })
    }
  });
}

type SbUser = {
  id: string; email: string; name: string; plan: string; is_admin: boolean;
  created_at: string; last_login_at: string | null; password_hash: string; pin_hash: string;
  plan_expires_at?: string | null;
  force_reauth?: boolean | null; current_device?: string | null; current_ip?: string | null;
  current_started_at?: string | null; failed_pin_attempts?: number | null;
  last_failed_pin_at?: string | null; pin_locked_until?: string | null;
};

class SupabaseStore implements Store {
  readonly name = 'supabase' as const;

  private mapUser(r: SbUser): StoredUser {
    return {
      id: r.id, email: r.email, name: r.name || '', plan: r.plan || 'free',
      plan_expires_at: r.plan_expires_at ?? null,
      is_admin: !!r.is_admin, created_at: r.created_at, last_login_at: r.last_login_at,
      password_hash: r.password_hash, pin_hash: r.pin_hash,
      force_reauth: !!r.force_reauth,
      current_device: r.current_device ?? null,
      current_ip: r.current_ip ?? null,
      current_started_at: r.current_started_at ?? null,
      failed_pin_attempts: r.failed_pin_attempts ?? 0,
      last_failed_pin_at: r.last_failed_pin_at ?? null,
      pin_locked_until: r.pin_locked_until ?? null
    };
  }

  private async tryProfilePatch(userId: string, patch: Record<string, unknown>): Promise<void> {
    try {
      const sb = await supabaseAdmin();
      const { error } = await sb.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    } catch {
      // Column may not exist yet (pre-migration DB) — do not break auth.
    }
  }

  async createUser(input: { email: string; name: string; password: string; pin: string; isAdmin?: boolean; createdAt?: string }): Promise<PublicUser> {
    const sb = await supabaseAdmin();
    const email = input.email.trim().toLowerCase();
    const { data: existing } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existing) {
      const err = new Error('An account with this email already exists.');
      (err as NodeJS.ErrnoException).code = 'EXISTS';
      throw err;
    }
    const now = input.createdAt || new Date().toISOString();
    const row = {
      id: randomUUID(), email, name: input.name.trim(), plan: 'free',
      is_admin: !!input.isAdmin, created_at: now, last_login_at: now,
      password_hash: hashSecret(input.password, newSalt()),
      pin_hash: hashSecret(input.pin, newSalt())
    };
    const { error } = await sb.from('profiles').insert(row);
    if (error) throw new Error(error.message);
    // seed first admin if configured
    return toPublic(this.mapUser(row as SbUser));
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const sb = await supabaseAdmin();
    const { data } = await sb.from('profiles').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
    return data ? this.mapUser(data as SbUser) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const sb = await supabaseAdmin();
    const { data } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
    return data ? this.mapUser(data as SbUser) : null;
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const sb = await supabaseAdmin();
    const { error } = await sb.from('profiles').update({ password_hash: hashSecret(newPassword, newSalt()) }).eq('id', userId);
    if (error) throw new Error(error.message);
  }

  verifyPin(user: StoredUser, pin: string): boolean {
    if (user.pin_locked_until && Date.parse(user.pin_locked_until) > Date.now()) return false;
    return verifySecret(pin.trim(), user.pin_hash);
  }

  async touchLogin(userId: string): Promise<void> {
    const sb = await supabaseAdmin();
    await sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
  }

  async createSession(userId: string, meta?: SessionMeta): Promise<string> {
    const sb = await supabaseAdmin();
    const token = newSessionToken();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    // SINGLE-BROWSER: revoke all other live sessions first.
    try {
      const { error: revErr } = await sb.from('sessions').update({ revoked_at: nowIso, revoke_reason: 'new_login' })
        .eq('user_id', userId).is('revoked_at', null);
      if (revErr) {
        // Pre-migration schema without revoked_at column: hard delete existing sessions
        await sb.from('sessions').delete().eq('user_id', userId);
      }
    } catch {
      try { await sb.from('sessions').delete().eq('user_id', userId); } catch { /* ignore */ }
    }
    const fullPayload = {
      token_hash: sha256(token), user_id: userId,
      device: (meta?.device || '').slice(0, 120) || null,
      ip: (meta?.ip || '').slice(0, 64) || null,
      created_at: nowIso,
      expires_at: new Date(now + SESSION_DAYS * 86400000).toISOString(),
      revoked_at: null,
      revoke_reason: null
    };
    const { error: insErr } = await sb.from('sessions').insert(fullPayload);
    if (insErr) {
      // Fallback for DBs without device/ip/revoked_at/revoke_reason columns
      const { error: fbErr } = await sb.from('sessions').insert({
        token_hash: sha256(token), user_id: userId,
        created_at: nowIso,
        expires_at: new Date(now + SESSION_DAYS * 86400000).toISOString()
      });
      if (fbErr) {
        console.error('Failed to create session in Supabase:', fbErr);
        throw new Error('Failed to create session: ' + fbErr.message);
      }
    }
    try {
      await sb.from('sessions').delete().lt('expires_at', new Date(now - 7 * 86400000).toISOString());
      // Hard single-session cleanup for legacy DBs: keep only newest live token
      const { data: live } = await sb.from('sessions').select('token_hash, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false });
      const rows = (live || []) as Array<{ token_hash: string; created_at: string }>;
      if (rows.length > 1) {
        const mine = sha256(token);
        const stale = rows.filter((r) => r.token_hash !== mine).map((r) => r.token_hash);
        if (stale.length) await sb.from('sessions').delete().in('token_hash', stale);
      }
    } catch { /* ignore */ }
    await this.tryProfilePatch(userId, {
      force_reauth: false,
      current_device: (meta?.device || '').slice(0, 120) || null,
      current_ip: (meta?.ip || '').slice(0, 64) || null,
      current_started_at: nowIso,
      last_login_at: nowIso
    });
    return token;
  }

  async getSessionUserWithStatus(token: string): Promise<SessionStatusResult> {
    if (!token) return { user: null, status: 'invalid' };
    const sb = await supabaseAdmin();
    const { data: s, error: sErr } = await sb.from('sessions').select('*').eq('token_hash', sha256(token)).maybeSingle();
    if (sErr || !s) return { user: null, status: 'invalid' };
    const row = s as { user_id: string; expires_at: string; revoked_at?: string | null; revoke_reason?: string | null; device?: string | null; ip?: string | null; created_at?: string };
    if (row.revoked_at) {
      if (row.revoke_reason === 'new_login') return { user: null, status: 'revoked_concurrent' };
      if (row.revoke_reason === 'admin_revoke') return { user: null, status: 'revoked_admin' };
      return { user: null, status: 'invalid' };
    }
    if (Date.parse(row.expires_at) <= Date.now()) return { user: null, status: 'expired' };
    const u = await this.findUserById(row.user_id);
    if (!u || u.force_reauth) return { user: null, status: 'invalid' };
    const user = { ...toPublic(u), current_device: row.device ?? u.current_device ?? null, current_ip: row.ip ?? u.current_ip ?? null, current_started_at: row.created_at ?? u.current_started_at ?? null };
    return { user, status: 'active' };
  }

  async getSessionUser(token: string): Promise<PublicUser | null> {
    const res = await this.getSessionUserWithStatus(token);
    return res.user;
  }

  async deleteSession(token: string): Promise<void> {
    const sb = await supabaseAdmin();
    const nowIso = new Date().toISOString();
    try {
      const { data, error } = await sb.from('sessions').update({ revoked_at: nowIso, revoke_reason: 'signout' })
        .eq('token_hash', sha256(token)).is('revoked_at', null).select('token_hash');
      if (error || !data || (data as unknown[]).length === 0) {
        await sb.from('sessions').delete().eq('token_hash', sha256(token));
      }
    } catch {
      await sb.from('sessions').delete().eq('token_hash', sha256(token));
    }
  }

  async listUserSessions(userId: string): Promise<SessionInfo[]> {
    const sb = await supabaseAdmin();
    try {
      const { data, error } = await sb.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return ((data || []) as Array<Record<string, string | null>>).map((r) => ({
        token_hash: String(r.token_hash || '').slice(0, 12) + '…',
        user_id: userId,
        device: (r.device as string) ?? null,
        ip: (r.ip as string) ?? null,
        created_at: String(r.created_at || ''),
        expires_at: String(r.expires_at || ''),
        revoked_at: (r.revoked_at as string) ?? null,
        revoke_reason: (r.revoke_reason as string) ?? null
      }));
    } catch {
      return [];
    }
  }

  async revokeUserSessions(userId: string, reason = 'admin_revoke'): Promise<number> {
    const sb = await supabaseAdmin();
    const nowIso = new Date().toISOString();
    let n = 0;
    try {
      const { data, error } = await sb.from('sessions').update({ revoked_at: nowIso, revoke_reason: reason })
        .eq('user_id', userId).is('revoked_at', null).select('token_hash');
      if (error) throw error;
      n = ((data || []) as unknown[]).length;
    } catch {
      const { data: live } = await sb.from('sessions').select('token_hash').eq('user_id', userId);
      const hashes = ((live || []) as Array<{ token_hash: string }>).map((r) => r.token_hash);
      if (hashes.length) {
        await sb.from('sessions').delete().in('token_hash', hashes);
        n = hashes.length;
      }
    }
    await this.tryProfilePatch(userId, { force_reauth: true, current_device: null, current_ip: null, current_started_at: null });
    return n;
  }

  async setUserPlan(userId: string, plan: string, expiresAt?: string | null): Promise<void> {
    const sb = await supabaseAdmin();
    const p = String(plan || '').toLowerCase().trim();
    if (!['free', 'pro'].includes(p)) throw new Error('Invalid plan.');
    const expiry = p === 'pro' ? (expiresAt ?? null) : null;
    const full = await sb.from('profiles').update({ plan: p, plan_expires_at: expiry }).eq('id', userId);
    if (!full.error) return;
    // Pre-migration DBs lack plan_expires_at: fall back to plan-only so the
    // grant still lands; surface a clear error only when an expiry was set.
    if (/plan_expires_at/i.test(full.error.message || '')) {
      const { error } = await sb.from('profiles').update({ plan: p }).eq('id', userId);
      if (error) throw new Error(error.message);
      if (expiry) {
        const err = new Error('Plan saved without expiration: run the plan_expires_at migration, then set the date again.');
        (err as NodeJS.ErrnoException).code = 'EXPIRY_UNSUPPORTED';
        throw err;
      }
      return;
    }
    throw new Error(full.error.message);
  }

  async resetUserPin(userId: string, newPin: string): Promise<void> {
    if (!/^\d{4}$/.test(String(newPin || '').trim())) throw new Error('Key must be exactly 4 digits.');
    const sb = await supabaseAdmin();
    const patch: Record<string, unknown> = { pin_hash: hashSecret(String(newPin).trim(), newSalt()) };
    const { error } = await sb.from('profiles').update(patch).eq('id', userId);
    if (error) throw new Error(error.message);
    await this.tryProfilePatch(userId, { failed_pin_attempts: 0, last_failed_pin_at: null, pin_locked_until: null });
    await this.clearFailedPin(userId);
  }

  async setForceReauth(userId: string, value: boolean): Promise<void> {
    await this.tryProfilePatch(userId, { force_reauth: value });
  }

  async recordFailedPin(userId: string): Promise<void> {
    const u = await this.findUserById(userId);
    if (!u) return;
    const n = (u.failed_pin_attempts || 0) + 1;
    const patch: Record<string, unknown> = { last_failed_pin_at: new Date().toISOString() };
    try { (patch as Record<string, unknown>).failed_pin_attempts = n; } catch { /* ignore */ }
    if (n >= 5) patch.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await this.tryProfilePatch(userId, patch);
  }

  async clearFailedPin(userId: string): Promise<void> {
    await this.tryProfilePatch(userId, { failed_pin_attempts: 0, last_failed_pin_at: null, pin_locked_until: null });
  }

  async appendAuditLog(entry: { admin_id: string | null; action: string; target_user_id?: string | null; details?: Record<string, unknown>; ip?: string | null; user_agent?: string | null }): Promise<void> {
    const sb = await supabaseAdmin();
    try {
      const { error } = await sb.from('admin_audit_log').insert({
        admin_id: entry.admin_id,
        action: String(entry.action || '').slice(0, 80),
        target_user_id: entry.target_user_id || null,
        details: entry.details || {},
        ip: entry.ip || null,
        user_agent: (entry.user_agent || '').slice(0, 200) || null
      });
      if (error) throw error;
    } catch {
      // Fallback: log as analytics event so nothing is lost pre-migration
      try {
        await this.insertEvents([{
          user_id: entry.target_user_id || null,
          event_name: 'security_admin_action',
          properties: { action: entry.action, admin_id: entry.admin_id || 'unknown' },
          session_id: null, client_version: null, platform: 'admin'
        }]);
      } catch { /* ignore */ }
    }
  }

  async listAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const sb = await supabaseAdmin();
    try {
      const lim = Math.max(1, Math.min(500, limit));
      const { data, error } = await sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(lim);
      if (error) throw error;
      return ((data || []) as Array<{ id: string; admin_id: string | null; action: string; target_user_id: string | null; details: Record<string, unknown>; ip: string | null; user_agent: string | null; created_at: string }>)
        .map((r) => ({ id: r.id, admin_id: r.admin_id, action: r.action, target_user_id: r.target_user_id, details: r.details || {}, ip: r.ip, user_agent: r.user_agent, created_at: r.created_at }));
    } catch {
      return [];
    }
  }

  async securityOverview(): Promise<SecurityOverview> {
    const sb = await supabaseAdmin();
    const now = Date.now();
    const weekAgoIso = new Date(now - 7 * 86400000).toISOString();
    let activeSessions = 0;
    let revoked7d = 0;
    try {
      const { count, error } = await sb.from('sessions').select('token_hash', { count: 'exact', head: true }).is('revoked_at', null).gt('expires_at', new Date(now).toISOString());
      if (error) {
        const fb = await sb.from('sessions').select('token_hash', { count: 'exact', head: true }).gt('expires_at', new Date(now).toISOString());
        activeSessions = fb.count || 0;
      } else {
        activeSessions = count || 0;
      }
    } catch { /* ignore */ }
    try {
      const { count } = await sb.from('sessions').select('token_hash', { count: 'exact', head: true }).gte('revoked_at', weekAgoIso);
      revoked7d = count || 0;
    } catch { /* ignore */ }
    let failedPin7d = 0;
    try {
      const { count } = await sb.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_name', 'security_pin_failed').gte('created_at', weekAgoIso);
      failedPin7d = count || 0;
    } catch { /* ignore */ }
    let forceReauthCount = 0;
    try {
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('force_reauth', true);
      forceReauthCount = count || 0;
    } catch { /* ignore */ }
    return { activeSessions, revoked7d, failedPin7d, forceReauthCount };
  }

  async insertEvents(rows: Array<Omit<EventRow, 'id' | 'created_at'> & { created_at?: string }>): Promise<number> {
    const sb = await supabaseAdmin();
    const now = new Date().toISOString();
    const payload = rows.slice(0, 500).map((r) => ({
      user_id: r.user_id, event_name: r.event_name,
      properties: r.properties && typeof r.properties === 'object' ? r.properties : {},
      session_id: r.session_id ?? null, client_version: r.client_version ?? null,
      platform: r.platform ?? null, created_at: r.created_at || now
    }));
    if (!payload.length) return 0;
    const { error } = await sb.from('analytics_events').insert(payload);
    if (error) throw new Error(error.message);
    return payload.length;
  }

  async listUsers(): Promise<StoredUser[]> {
    const sb = await supabaseAdmin();
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return ((data || []) as SbUser[]).map((r) => this.mapUser(r));
  }

  async listEvents(opts: { limit: number; event?: string; userId?: string; q?: string }): Promise<EventRow[]> {
    const sb = await supabaseAdmin();
    const limit = Math.max(1, Math.min(20000, opts.limit || 100));
    let query = sb.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(Math.min(limit, 1000));
    if (opts.event) query = query.eq('event_name', opts.event);
    if (opts.userId) query = query.eq('user_id', opts.userId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    let rows = (data || []) as EventRow[];
    const q = (opts.q || '').trim().toLowerCase();
    if (q) rows = rows.filter((e) => JSON.stringify(e.properties).toLowerCase().includes(q) || (e.event_name || '').includes(q));
    return rows;
  }

  async aggregates(): Promise<Map<string, UserAggregate>> {
    const sb = await supabaseAdmin();
    const { data, error } = await sb.from('analytics_events').select('user_id, event_name, properties, created_at').limit(20000);
    if (error) throw new Error(error.message);
    const map = new Map<string, UserAggregate>();
    for (const e of (data || []) as Array<{ user_id: string | null; event_name: string; properties: Record<string, unknown>; created_at: string }>) {
      if (!e.user_id) continue;
      let a = map.get(e.user_id);
      if (!a) { a = emptyAggregate(); map.set(e.user_id, a); }
      a.events += 1;
      if (!a.lastSeen || e.created_at > a.lastSeen) a.lastSeen = e.created_at;
      if (UPLOAD_EVENTS.has(e.event_name)) {
        a.uploads += 1;
        bumpType(a.uploadsByType, e.properties?.source_type);
      }
      if (CONVERT_EVENTS.has(e.event_name)) {
        a.conversions += 1;
        const t = e.properties?.tokens_saved;
        if (typeof t === 'number' && Number.isFinite(t)) a.tokensSaved += Math.round(t);
        bumpType(a.conversionsByType, e.properties?.source_type);
      }
    }
    for (const a of map.values()) {
      if (a.uploads < a.conversions) a.uploads = a.conversions;
      for (const [k, v] of Object.entries(a.conversionsByType)) {
        if (!a.uploadsByType[k] || a.uploadsByType[k] < v) a.uploadsByType[k] = v;
      }
    }
    return map;
  }

  async saveUserDocument(userId: string, doc: DocumentInput): Promise<string> {
    const sb = await supabaseAdmin();
    const id = doc.id || ('doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
    const now = doc.createdAt || new Date().toISOString();
    const row = {
      id,
      user_id: userId,
      title: String(doc.title || 'document').slice(0, 120),
      preset: doc.preset || 'claude',
      markdown: String(doc.markdown || ''),
      chunks: Array.isArray(doc.chunks) ? doc.chunks : [],
      pages: doc.pages || 0,
      tokens: doc.tokens || 0,
      source_type: normalizeSourceType(doc.source_type),
      ocr_used: !!doc.ocr_used,
      created_at: now,
      updated_at: new Date().toISOString()
    };
    let { error } = await sb.from('user_documents').upsert(row);
    if (error && (error.message.includes('source_type') || error.message.includes('ocr_used'))) {
      const fallbackRow = { ...row };
      delete (fallbackRow as Record<string, unknown>).source_type;
      delete (fallbackRow as Record<string, unknown>).ocr_used;
      const res = await sb.from('user_documents').upsert(fallbackRow);
      error = res.error;
    }
    if (error) throw new Error(error.message);
    return id;
  }

  async listUserDocuments(userId: string, limit = 20): Promise<DocumentSummary[]> {
    const sb = await supabaseAdmin();
    const lim = Math.max(1, Math.min(100, limit));
    let { data, error } = await sb
      .from('user_documents')
      .select('id, title, preset, pages, tokens, source_type, created_at, chunks')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(lim);
    if (error && error.message.includes('source_type')) {
      const fallback = await sb
        .from('user_documents')
        .select('id, title, preset, pages, tokens, created_at, chunks')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(lim);
      data = fallback.data as any;
      error = fallback.error;
    }
    if (error) throw new Error(error.message);
    return ((data || []) as Array<{
      id: string; title: string; preset: string; pages: number; tokens: number; source_type?: string; created_at: string; chunks: unknown;
    }>).map((r) => ({
      id: r.id,
      title: r.title,
      preset: r.preset || 'claude',
      pages: r.pages || 0,
      tokens: r.tokens || 0,
      source_type: normalizeSourceType(r.source_type),
      createdAt: Date.parse(r.created_at) || Date.now(),
      chunkCount: Array.isArray(r.chunks) ? r.chunks.length : 0
    }));
  }

  async getUserDocument(userId: string, docId: string): Promise<DocumentRow | null> {
    const sb = await supabaseAdmin();
    const { data, error } = await sb
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('id', docId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const r = data as {
      id: string; user_id: string; title: string; preset: string; markdown: string;
      chunks: unknown; pages: number; tokens: number; source_type?: string; ocr_used?: boolean; created_at: string; updated_at: string;
    };
    return {
      id: r.id,
      user_id: r.user_id,
      title: r.title,
      preset: r.preset,
      markdown: r.markdown,
      chunks: Array.isArray(r.chunks) ? r.chunks as string[] : [],
      pages: r.pages,
      tokens: r.tokens,
      source_type: normalizeSourceType(r.source_type),
      ocr_used: !!r.ocr_used,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  }

  async deleteUserDocument(userId: string, docId: string): Promise<boolean> {
    const sb = await supabaseAdmin();
    const { error } = await sb
      .from('user_documents')
      .delete()
      .eq('user_id', userId)
      .eq('id', docId);
    if (error) throw new Error(error.message);
    return true;
  }

  async resetForTests(): Promise<void> {
    const sb = await supabaseAdmin();
    await sb.from('user_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('analytics_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('sessions').delete().neq('token_hash', 'x');
    await sb.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

let cached: Store | null = null;

export function isDemoStore(): boolean {
  return !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStore(): Store {
  if (cached) return cached;
  cached = isDemoStore() ? new DemoStore() : new SupabaseStore();
  return cached;
}
