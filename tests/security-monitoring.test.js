import { describe, it, expect, beforeEach } from 'vitest';
import {
  bucketize, computeCards, computePeriodComparison, computeUserActivityDetails,
  computeFunnel, computeRetention, uploadsByTypeTotals, normalizeType
} from '../admin/lib/metrics.ts';
import { detectAnomalies } from '../admin/lib/security.ts';

const NOW = new Date('2026-09-22T12:00:00Z');
const iso = (daysAgo, h = 0) => new Date(NOW.getTime() - daysAgo * 86400000 + h * 3600000).toISOString();

describe('monitoring metrics', () => {
  const users = [
    { id: 'u1', created_at: iso(10), email: 'a@x.com', name: 'A', plan: 'free' },
    { id: 'u2', created_at: iso(2), email: 'b@x.com', name: 'B', plan: 'pro' }
  ];
  const events = [
    { user_id: 'u1', event_name: 'file_select', properties: { source_type: 'pdf' }, created_at: iso(1) },
    { user_id: 'u1', event_name: 'convert_start', properties: { source_type: 'pdf' }, created_at: iso(1) },
    { user_id: 'u1', event_name: 'convert_success', properties: { source_type: 'pdf', tokens_saved: 1000 }, created_at: iso(1) },
    { user_id: 'u1', event_name: 'download', properties: {}, created_at: iso(1) },
    { user_id: 'u2', event_name: 'file_select', properties: { source_type: 'docx' }, created_at: iso(8) },
    { user_id: 'u2', event_name: 'convert_success', properties: { source_type: 'docx', tokens_saved: 500 }, created_at: iso(8) },
    { user_id: null, event_name: 'file_select', properties: {}, created_at: iso(0) }
  ];

  it('bucketize counts uploads + conversions', () => {
    const rows = bucketize(users, events, 10, NOW);
    expect(rows).toHaveLength(10);
    const totalUploads = rows.reduce((s, r) => s + r.uploads, 0);
    const totalConv = rows.reduce((s, r) => s + r.conversions, 0);
    expect(totalUploads).toBe(4); // 3 uploads u1 (file_select counts) +...: file_selectx2 + convert_start = 4 counted (anonymous file_select is day 0 within window? iso(0) same day)
    expect(totalConv).toBe(2);
  });

  it('computeCards exposes uploads windows', () => {
    const c = computeCards(users, events, NOW);
    expect(c.totalUsers).toBe(2);
    expect(c.uploads7d).toBeGreaterThanOrEqual(2);
    expect(c.uploads30d).toBeGreaterThanOrEqual(4);
    expect(c.conversions7d).toBe(1);
    expect(c.conversions30d).toBe(2);
    expect(c.byUploadType.pdf).toBeGreaterThanOrEqual(2);
    expect(c.bySourceType.pdf).toBe(1);
  });

  it('period comparison has 7d + 30d with pct', () => {
    const [w, m] = computePeriodComparison(users, events, NOW);
    expect(w.period).toBe('7d');
    expect(m.period).toBe('30d');
    expect(w.current.conversions).toBe(1);
    expect(w.previous.conversions).toBe(1);
    expect(typeof w.pctChange.uploads).toBe('number');
  });

  it('per-user details track types + rate + trend', () => {
    const d = computeUserActivityDetails(users, events, NOW);
    const u1 = d.find((x) => x.userId === 'u1');
    expect(u1.totalUploads).toBe(2); // file_select + convert_start
    expect(u1.uploadsByType.pdf).toBe(2);
    expect(u1.totalConversions).toBe(1);
    expect(u1.conversionRate).toBe(50);
    expect(u1.uploads7d).toBe(2);
    expect(['up', 'down', 'flat']).toContain(u1.trend7d);
  });

  it('funnel + retention + upload mix', () => {
    const f = computeFunnel(events, NOW, 30);
    expect(f[0].key).toBe('upload');
    expect(f.find((s) => s.key === 'convert_success').count).toBe(2);
    const r = computeRetention(users, events, NOW);
    expect(Array.isArray(r)).toBe(true);
    const mix = uploadsByTypeTotals(events, NOW, 30);
    expect(mix.pdf).toBeGreaterThanOrEqual(2);
  });

  it('normalizeType fuzzy maps', () => {
    expect(normalizeType('PPT')).toBe('pptx');
    expect(normalizeType('img')).toBe('image');
    expect(normalizeType('')).toBe('pdf');
  });
});

describe('security anomalies', () => {
  it('flags pin bursts + ip/device changes + revokes', () => {
    const ev = [
      { user_id: 'u1', event_name: 'security_pin_failed', properties: {}, created_at: iso(0), id: '1', session_id: null, client_version: null, platform: null },
      { user_id: 'u1', event_name: 'security_pin_failed', properties: {}, created_at: iso(0), id: '2', session_id: null, client_version: null, platform: null },
      { user_id: 'u1', event_name: 'security_pin_failed', properties: {}, created_at: iso(0), id: '3', session_id: null, client_version: null, platform: null },
      { user_id: 'u2', event_name: 'security_ip_changed', properties: { old_ip: '1.1.1.1', new_ip: '2.2.2.2' }, created_at: iso(0), id: '4', session_id: null, client_version: null, platform: null },
      { user_id: 'u2', event_name: 'security_session_revoked', properties: { reason: 'new_login' }, created_at: iso(0), id: '5', session_id: null, client_version: null, platform: null }
    ];
    const out = detectAnomalies(ev, new Map([['u1', 'a@x.com'], ['u2', 'b@x.com']]));
    expect(out.some((a) => a.kind === 'pin_failures')).toBe(true);
    expect(out.some((a) => a.kind === 'ip_change')).toBe(true);
    expect(out.some((a) => a.kind === 'forced_reauth')).toBe(true);
  });
});

describe('single-session store enforcement (demo)', () => {
  beforeEach(() => {
    process.env.DEMO_DB_PATH = 'C:\\Users\\Deepan\\AppData\\Local\\Temp\\opencode\\tt-vitest-db.json';
    process.env.SEED_ADMIN = 'false';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('second sign-in revokes the first token', async () => {
    const { getStore } = await import('../admin/lib/store.ts');
    const store = getStore();
    expect(store.name).toBe('demo');
    await store.resetForTests();
    const u = await store.createUser({ email: 'single@test.local', name: 'Single', password: 'Password123', pin: '1234' });
    const t1 = await store.createSession(u.id, { device: 'Chrome · Windows', ip: '1.1.1.1' });
    expect(await store.getSessionUser(t1)).not.toBe(null);
    const t2 = await store.createSession(u.id, { device: 'Safari · macOS', ip: '2.2.2.2' });
    expect(await store.getSessionUser(t1)).toBe(null); // kicked
    const me = await store.getSessionUser(t2);
    expect(me && me.id).toBe(u.id);
    const sessions = await store.listUserSessions(u.id);
    expect(sessions.filter((s) => !s.revoked_at)).toHaveLength(1);
    // admin revoke kills the last one too
    const n = await store.revokeUserSessions(u.id, 'admin_revoke');
    expect(n).toBe(1);
    expect(await store.getSessionUser(t2)).toBe(null);
    const audit = await store.listAuditLog(10);
    expect(Array.isArray(audit)).toBe(true);
  });
});
