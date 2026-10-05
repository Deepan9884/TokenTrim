/** Pure aggregation helpers for dashboard charts — unit-tested from root vitest. */

export interface DayBucket {
  date: string; // YYYY-MM-DD
  signups: number;
  activeUsers: number;
  uploads: number;
  conversions: number;
  tokensSaved: number;
}

export interface MinimalUser {
  id: string;
  created_at: string;
  email?: string;
  name?: string;
  plan?: string;
  last_login_at?: string | null;
}

export interface MinimalEvent {
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export const UPLOAD_EVENT_NAMES = new Set([
  'file_select', 'upload_start', 'upload_complete', 'convert_start'
]);

export const CONVERT_EVENT_NAMES = new Set(['convert_success']);

const KNOWN_TYPES = new Set(['pdf', 'docx', 'pptx', 'image', 'xlsx', 'csv', 'text', 'html', 'epub', 'other']);

export function normalizeType(raw: unknown): string {
  const s = String(raw || '').toLowerCase().trim();
  if (KNOWN_TYPES.has(s)) return s;
  if (s === 'ppt' || s === 'presentation') return 'pptx';
  if (s === 'doc' || s === 'word') return 'docx';
  if (s === 'xls' || s === 'sheet' || s === 'spreadsheet') return 'xlsx';
  if (s === 'img' || s === 'photo' || s.startsWith('image')) return 'image';
  if (!s) return 'pdf';
  return 'other';
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number, now = new Date()): string[] {
  const out: string[] = [];
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(new Date(base.getTime() - i * 86400000)));
  }
  return out;
}

function numProp(props: Record<string, unknown>, key: string): number {
  const v = props?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Bucket users + events into per-day series for the last N days. */
export function bucketize(users: MinimalUser[], events: MinimalEvent[], days: number, now = new Date()): DayBucket[] {
  const keys = lastNDays(Math.max(1, Math.min(365, days)), now);
  const map = new Map<string, DayBucket>(keys.map((k) => [k, { date: k, signups: 0, activeUsers: 0, uploads: 0, conversions: 0, tokensSaved: 0 }]));
  const active = new Map<string, Set<string>>();

  const userIds = new Set(users.map((u) => u.id));
  for (const u of users) {
    const k = String(u.created_at || '').slice(0, 10);
    const b = map.get(k);
    if (b) b.signups += 1;
  }
  for (const e of events) {
    const k = String(e.created_at || '').slice(0, 10);
    const b = map.get(k);
    if (!b) continue;
    if (e.user_id && (userIds.size === 0 || userIds.has(e.user_id))) {
      let set = active.get(k);
      if (!set) { set = new Set(); active.set(k, set); }
      set.add(e.user_id);
    }
    if (UPLOAD_EVENT_NAMES.has(e.event_name)) b.uploads += 1;
    if (CONVERT_EVENT_NAMES.has(e.event_name)) {
      b.conversions += 1;
      b.tokensSaved += numProp(e.properties, 'tokens_saved');
    }
  }
  for (const b of map.values()) {
    if (b.uploads < b.conversions) b.uploads = b.conversions;
  }
  for (const [k, set] of active) {
    const b = map.get(k);
    if (b) b.activeUsers = set.size;
  }
  return [...map.values()];
}

export interface Cards {
  totalUsers: number;
  newSignups7d: number;
  activeUsers7d: number;
  uploads7d: number;
  uploads30d: number;
  conversions7d: number;
  conversions30d: number;
  tokensSaved30d: number;
  bySourceType?: Record<string, number>;
  byUploadType?: Record<string, number>;
}

/** Headline cards from raw rows (period-aware where cheap). */
export function computeCards(users: MinimalUser[], events: MinimalEvent[], now = new Date()): Cards {
  const weekAgo = now.getTime() - 7 * 86400000;
  const monthAgo = now.getTime() - 30 * 86400000;
  let newSignups7d = 0;
  for (const u of users) {
    if (Date.parse(u.created_at || '') >= weekAgo) newSignups7d += 1;
  }
  const userIds = new Set(users.map((u) => u.id));
  const active7d = new Set<string>();
  let uploads7d = 0;
  let uploads30d = 0;
  let conversions7d = 0;
  let conversions30d = 0;
  let tokensSaved30d = 0;
  const bySourceType: Record<string, number> = {};
  const byUploadType: Record<string, number> = {};
  for (const e of events) {
    const t = Date.parse(e.created_at || '');
    if (Number.isNaN(t)) continue;
    if (e.user_id && t >= weekAgo && (userIds.size === 0 || userIds.has(e.user_id))) active7d.add(e.user_id);
    if (UPLOAD_EVENT_NAMES.has(e.event_name)) {
      if (t >= weekAgo) uploads7d += 1;
      if (t >= monthAgo) {
        uploads30d += 1;
        const k = normalizeType((e.properties as Record<string, unknown>)?.source_type);
        byUploadType[k] = (byUploadType[k] || 0) + 1;
      }
    }
    if (CONVERT_EVENT_NAMES.has(e.event_name)) {
      if (t >= weekAgo) conversions7d += 1;
      if (t >= monthAgo) {
        conversions30d += 1;
        tokensSaved30d += numProp(e.properties, 'tokens_saved');
        const k = normalizeType((e.properties as Record<string, unknown>)?.source_type);
        bySourceType[k] = (bySourceType[k] || 0) + 1;
      }
    }
  }
  uploads7d = Math.max(uploads7d, conversions7d);
  uploads30d = Math.max(uploads30d, conversions30d);
  for (const [k, v] of Object.entries(bySourceType)) {
    if (!byUploadType[k] || byUploadType[k] < v) {
      byUploadType[k] = v;
    }
  }
  return {
    totalUsers: users.length,
    newSignups7d,
    activeUsers7d: active7d.size,
    uploads7d,
    uploads30d,
    conversions7d,
    conversions30d,
    tokensSaved30d,
    bySourceType,
    byUploadType
  };
}

export interface PeriodTotals {
  signups: number;
  activeUsers: number;
  uploads: number;
  conversions: number;
  tokensSaved: number;
}

export interface PeriodComparison {
  period: '7d' | '30d';
  current: PeriodTotals;
  previous: PeriodTotals;
  pctChange: PeriodTotals; // percent, e.g. 25 = +25%. 0 when previous is 0 and current is 0; 100 when previous 0 and current >0.
}

function totalsInWindow(users: MinimalUser[], events: MinimalEvent[], from: number, to: number): PeriodTotals {
  let signups = 0;
  for (const u of users) {
    const t = Date.parse(u.created_at || '');
    if (!Number.isNaN(t) && t >= from && t < to) signups += 1;
  }
  const userIds = new Set(users.map((u) => u.id));
  const active = new Set<string>();
  let uploads = 0;
  let conversions = 0;
  let tokensSaved = 0;
  for (const e of events) {
    const t = Date.parse(e.created_at || '');
    if (Number.isNaN(t) || t < from || t >= to) continue;
    if (e.user_id && (userIds.size === 0 || userIds.has(e.user_id))) active.add(e.user_id);
    if (UPLOAD_EVENT_NAMES.has(e.event_name)) uploads += 1;
    if (CONVERT_EVENT_NAMES.has(e.event_name)) {
      conversions += 1;
      tokensSaved += numProp(e.properties, 'tokens_saved');
    }
  }
  uploads = Math.max(uploads, conversions);
  return { signups, activeUsers: active.size, uploads, conversions, tokensSaved };
}

function pct(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** Week-over-week (7d vs prior 7d) and month-over-month (30d vs prior 30d) growth. */
export function computePeriodComparison(users: MinimalUser[], events: MinimalEvent[], now = new Date()): PeriodComparison[] {
  const t = now.getTime();
  const mk = (days: 7 | 30): PeriodComparison => {
    const span = days * 86400000;
    const current = totalsInWindow(users, events, t - span, t);
    const previous = totalsInWindow(users, events, t - span * 2, t - span);
    return {
      period: `${days}d` as '7d' | '30d',
      current,
      previous,
      pctChange: {
        signups: pct(current.signups, previous.signups),
        activeUsers: pct(current.activeUsers, previous.activeUsers),
        uploads: pct(current.uploads, previous.uploads),
        conversions: pct(current.conversions, previous.conversions),
        tokensSaved: pct(current.tokensSaved, previous.tokensSaved)
      }
    };
  };
  return [mk(7), mk(30)];
}

export interface UserActivityDetail {
  userId: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
  lastSeen: string | null;
  totalUploads: number;
  uploadsByType: Record<string, number>;
  totalConversions: number;
  conversionsByType: Record<string, number>;
  totalTokensSaved: number;
  totalEvents: number;
  activeDays: number;
  conversionRate: number; // 0..100
  avgTokensPerConversion: number;
  uploads7d: number;
  conversions7d: number;
  uploads30d: number;
  conversions30d: number;
  trend7d: 'up' | 'down' | 'flat';
}

/** Per-user activity roll-up. Privacy-safe: counts + types only, never file contents. */
export function computeUserActivityDetails(
  users: MinimalUser[],
  events: MinimalEvent[],
  now = new Date()
): UserActivityDetail[] {
  const weekAgo = now.getTime() - 7 * 86400000;
  const halfMonthAgo = now.getTime() - 14 * 86400000;
  const monthAgo = now.getTime() - 30 * 86400000;
  interface Acc {
    uploads: number; uploadsByType: Record<string, number>;
    conversions: number; conversionsByType: Record<string, number>;
    tokens: number; events: number; lastSeen: string | null;
    days: Set<string>; uploads7d: number; conversions7d: number;
    uploads30d: number; conversions30d: number;
    uploadsPrev7d: number; conversionsPrev7d: number;
  }
  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = {
        uploads: 0, uploadsByType: {}, conversions: 0, conversionsByType: {},
        tokens: 0, events: 0, lastSeen: null, days: new Set(),
        uploads7d: 0, conversions7d: 0, uploads30d: 0, conversions30d: 0,
        uploadsPrev7d: 0, conversionsPrev7d: 0
      };
      acc.set(id, a);
    }
    return a;
  };
  for (const e of events) {
    if (!e.user_id) continue;
    const a = get(e.user_id);
    const t = Date.parse(e.created_at || '');
    a.events += 1;
    if (!a.lastSeen || e.created_at > a.lastSeen) a.lastSeen = e.created_at;
    if (!Number.isNaN(t)) a.days.add(new Date(t).toISOString().slice(0, 10));
    if (UPLOAD_EVENT_NAMES.has(e.event_name)) {
      a.uploads += 1;
      const k = normalizeType((e.properties as Record<string, unknown>)?.source_type);
      a.uploadsByType[k] = (a.uploadsByType[k] || 0) + 1;
      if (!Number.isNaN(t)) {
        if (t >= weekAgo) a.uploads7d += 1;
        else if (t >= halfMonthAgo) a.uploadsPrev7d += 1;
        if (t >= monthAgo) a.uploads30d += 1;
      }
    }
    if (CONVERT_EVENT_NAMES.has(e.event_name)) {
      a.conversions += 1;
      const k = normalizeType((e.properties as Record<string, unknown>)?.source_type);
      a.conversionsByType[k] = (a.conversionsByType[k] || 0) + 1;
      a.tokens += numProp(e.properties, 'tokens_saved');
      if (!Number.isNaN(t)) {
        if (t >= weekAgo) a.conversions7d += 1;
        else if (t >= halfMonthAgo) a.conversionsPrev7d += 1;
        if (t >= monthAgo) a.conversions30d += 1;
      }
    }
  }
  return users.map((u) => {
    const a = acc.get(u.id);
    const rawUploads = a?.uploads || 0;
    const conversions = a?.conversions || 0;
    const uploads = Math.max(rawUploads, conversions);
    const uploadsByType = { ...(a?.uploadsByType || {}) };
    for (const [k, v] of Object.entries(a?.conversionsByType || {})) {
      if (!uploadsByType[k] || uploadsByType[k] < v) {
        uploadsByType[k] = v;
      }
    }
    const uploads7d = Math.max(a?.uploads7d || 0, a?.conversions7d || 0);
    const uploads30d = Math.max(a?.uploads30d || 0, a?.conversions30d || 0);
    const activity = uploads7d + (a?.conversions7d || 0);
    const prev = (a?.uploadsPrev7d || 0) + (a?.conversionsPrev7d || 0);
    return {
      userId: u.id,
      email: u.email || '',
      name: u.name || '',
      plan: u.plan || 'free',
      createdAt: u.created_at,
      lastSeen: a?.lastSeen || u.last_login_at || null,
      totalUploads: uploads,
      uploadsByType,
      totalConversions: conversions,
      conversionsByType: a?.conversionsByType || {},
      totalTokensSaved: a?.tokens || 0,
      totalEvents: a?.events || 0,
      activeDays: a?.days.size || 0,
      conversionRate: uploads === 0 ? 0 : Math.min(100, Math.round((conversions / uploads) * 1000) / 10),
      avgTokensPerConversion: conversions === 0 ? 0 : Math.round((a?.tokens || 0) / conversions),
      uploads7d,
      conversions7d: a?.conversions7d || 0,
      uploads30d,
      conversions30d: a?.conversions30d || 0,
      trend7d: activity > prev ? 'up' : activity < prev ? 'down' : 'flat'
    };
  });
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  rate: number; // % of first step
}

export function computeFunnel(events: MinimalEvent[], now = new Date(), days = 30): FunnelStep[] {
  const from = now.getTime() - days * 86400000;
  const counts: Record<string, number> = { file_select: 0, convert_start: 0, convert_success: 0, download: 0, copy: 0 };
  for (const e of events) {
    const t = Date.parse(e.created_at || '');
    if (Number.isNaN(t) || t < from) continue;
    if (e.event_name in counts) counts[e.event_name] += 1;
  }
  // Uploads may arrive as upload_complete when file_select is skipped — fold them in.
  let uploadExtra = 0;
  for (const e of events) {
    const t = Date.parse(e.created_at || '');
    if (Number.isNaN(t) || t < from) continue;
    if (e.event_name === 'upload_complete' || e.event_name === 'upload_start') uploadExtra += 1;
  }
  const uploadCount = Math.max(counts.file_select + uploadExtra, counts.convert_start, counts.convert_success);
  const startCount = Math.max(counts.convert_start, counts.convert_success);
  const steps: Array<[string, string, number]> = [
    ['upload', 'Uploads', uploadCount],
    ['convert_start', 'Conversions started', startCount],
    ['convert_success', 'Conversions done', counts.convert_success],
    ['download', 'Downloads', counts.download],
    ['copy', 'Copies', counts.copy]
  ];
  const base = Math.max(1, steps[0][2]);
  return steps.map(([key, label, count]) => ({
    key, label, count,
    rate: Math.round((count / base) * 1000) / 10
  }));
}

export interface RetentionCohort {
  cohort: string; // YYYY-MM-DD (signup week start)
  size: number;
  week0: number; week1: number; week2: number; week3: number; week4: number;
}

export function computeRetention(users: MinimalUser[], events: MinimalEvent[], now = new Date()): RetentionCohort[] {
  const activeByUser = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.user_id) continue;
    let s = activeByUser.get(e.user_id);
    if (!s) { s = new Set(); activeByUser.set(e.user_id, s); }
    s.add(String(e.created_at || '').slice(0, 10));
  }
  const cohorts = new Map<string, MinimalUser[]>();
  const cutoff = now.getTime() - 8 * 7 * 86400000;
  for (const u of users) {
    const t = Date.parse(u.created_at || '');
    if (Number.isNaN(t) || t < cutoff) continue;
    const d = new Date(t);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - dow);
    const k = monday.toISOString().slice(0, 10);
    const list = cohorts.get(k) || [];
    list.push(u);
    cohorts.set(k, list);
  }
  const out: RetentionCohort[] = [];
  for (const [cohort, members] of [...cohorts.entries()].sort().slice(-6)) {
    const start = Date.parse(cohort + 'T00:00:00Z');
    const inWeek = (idx: number) => {
      const from = start + idx * 7 * 86400000;
      const to = from + 7 * 86400000;
      let n = 0;
      for (const m of members) {
        const days = activeByUser.get(m.id);
        if (!days) continue;
        for (const day of days) {
          const t = Date.parse(day + 'T00:00:00Z');
          if (t >= from && t < to) { n += 1; break; }
        }
      }
      return members.length === 0 ? 0 : Math.round((n / members.length) * 1000) / 10;
    };
    out.push({ cohort, size: members.length, week0: inWeek(0), week1: inWeek(1), week2: inWeek(2), week3: inWeek(3), week4: inWeek(4) });
  }
  return out;
}

export function topUsersByConversions(details: UserActivityDetail[], limit = 10): UserActivityDetail[] {
  return [...details].sort((a, b) => b.totalConversions - a.totalConversions).slice(0, Math.max(1, Math.min(50, limit)));
}

export function uploadsByTypeTotals(events: MinimalEvent[], now = new Date(), days = 30): Record<string, number> {
  const from = now.getTime() - days * 86400000;
  const out: Record<string, number> = {};
  for (const e of events) {
    const t = Date.parse(e.created_at || '');
    if (Number.isNaN(t) || t < from) continue;
    if (!UPLOAD_EVENT_NAMES.has(e.event_name) && !CONVERT_EVENT_NAMES.has(e.event_name)) continue;
    const k = normalizeType((e.properties as Record<string, unknown>)?.source_type);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
