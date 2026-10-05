'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ManagePlanButton } from './PlanModal';
import { FormattedEvent } from '../../../lib/event-formatter';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  plan: string;
  plan_expires_at: string | null;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  uploads: number;
  uploadsByType: Record<string, number>;
  conversions: number;
  conversionsByType: Record<string, number>;
  conversionRate: number;
  uploads7d: number;
  conversions7d: number;
  tokensSaved: number;
  events: number;
  activeDays?: number;
  trend7d?: 'up' | 'down' | 'flat';
  lastSeen: string | null;
  force_reauth?: boolean;
  current_device?: string | null;
  current_ip?: string | null;
}

interface RecentEvent {
  event_name: string;
  created_at: string;
  properties: Record<string, unknown>;
}

type SortKey = 'email' | 'created_at' | 'uploads' | 'conversions' | 'conversionRate' | 'tokensSaved' | 'lastSeen';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US');
}

function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…` : id;
}

function trendIcon(t?: string): string {
  if (t === 'up') return '▲';
  if (t === 'down') return '▼';
  return '●';
}

function trendColor(t?: string): string {
  if (t === 'up') return '#2e6b3e';
  if (t === 'down') return '#9e2b25';
  return 'var(--muted)';
}

function topTypes(m: Record<string, number>, n = 2): string {
  const e = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (e.length === 0) return '—';
  return e.map(([t, c]) => `${t}:${c}`).join(' · ');
}

function fmtExpiryShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return 'expired';
  return `→ ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [activity, setActivity] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Record<string, RecentEvent[]>>({});
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = [...rows];
    if (needle) {
      list = list.filter((r) => r.email.toLowerCase().includes(needle) || (r.name || '').toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle));
    }
    if (plan) list = list.filter((r) => r.plan === plan);
    if (activity === 'active7') list = list.filter((r) => (r.uploads7d + r.conversions7d) > 0);
    else if (activity === 'idle30') {
      const cutoff = Date.now() - 30 * 86400000;
      list = list.filter((r) => !r.lastSeen || Date.parse(r.lastSeen) < cutoff);
    } else if (activity === 'noupload') list = list.filter((r) => r.uploads === 0);
    else if (activity === 'flagged') list = list.filter((r) => r.force_reauth);
    list.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [rows, q, plan, activity, sortKey, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const view = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setDir(-1); }
  }

  async function toggleRow(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!recent[id]) {
      try {
        const res = await fetch(`/api/admin/events?userId=${encodeURIComponent(id)}&limit=8`);
        const data = await res.json();
        if (res.ok) setRecent((m) => ({ ...m, [id]: data.events || [] }));
      } catch { /* ignore */ }
    }
  }

  const arrow = (k: SortKey) => (sortKey === k ? (dir === 1 ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <div className="toolbar">
        <input placeholder="Search email, name, or id…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ minWidth: 220 }} aria-label="Search users" />
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(0); }} aria-label="Plan filter">
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <select value={activity} onChange={(e) => { setActivity(e.target.value); setPage(0); }} aria-label="Activity filter">
          <option value="">All activity</option>
          <option value="active7">Active · 7d</option>
          <option value="idle30">Idle · 30d+</option>
          <option value="noupload">No uploads yet</option>
          <option value="flagged">Needs re-auth</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{filtered.length} shown</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th onClick={() => toggleSort('email')}>User{arrow('email')}</th>
              <th>ID</th>
              <th>Plan</th>
              <th onClick={() => toggleSort('uploads')}>Uploads{arrow('uploads')}</th>
              <th onClick={() => toggleSort('conversions')}>Conv.{arrow('conversions')}</th>
              <th onClick={() => toggleSort('conversionRate')}>Rate{arrow('conversionRate')}</th>
              <th onClick={() => toggleSort('tokensSaved')}>Tokens{arrow('tokensSaved')}</th>
              <th>Trend 7d</th>
              <th onClick={() => toggleSort('lastSeen')}>Last seen{arrow('lastSeen')}</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => toggleRow(r.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {r.name || '—'}{' '}
                      {r.force_reauth && <span className="pill" style={{ background: '#fbe9e4', borderColor: '#eec5bf', color: '#9e2b25' }}>re-auth</span>}
                    </div>
                  </td>
                  <td className="mono" title={r.id}>{shortId(r.id)}</td>
                  <td>
                    <span className={r.plan === 'pro' ? 'pill pro' : 'pill'}>{r.plan}</span>
                    {r.plan === 'pro' && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {fmtExpiryShort(r.plan_expires_at) || 'perpetual'}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{fmtNum(r.uploads)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }} title={JSON.stringify(r.uploadsByType)}>{topTypes(r.uploadsByType)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{fmtNum(r.conversions)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }} title={JSON.stringify(r.conversionsByType)}>{topTypes(r.conversionsByType)}</div>
                  </td>
                  <td>{r.conversionRate}%</td>
                  <td>{fmtNum(r.tokensSaved)}</td>
                  <td title={`${r.uploads7d} uploads · ${r.conversions7d} conversions in 7d`}>
                    <span style={{ color: trendColor(r.trend7d), fontWeight: 700 }}>{trendIcon(r.trend7d)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{r.uploads7d + r.conversions7d}/7d</span>
                  </td>
                  <td>{fmtDate(r.lastSeen)}</td>
                </tr>
                {openId === r.id && (
                  <tr key={`${r.id}-detail`}>
                    <td colSpan={9}>
                      <div className="detail">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <strong>Recent activity</strong>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <ManagePlanButton
                              userId={r.id}
                              userEmail={r.email}
                              currentPlan={r.plan}
                              currentExpiresAt={r.plan_expires_at}
                              label="Manage plan"
                              onSaved={() => router.refresh()}
                            />
                            <Link href={`/users/${r.id}`} style={{ fontSize: 12 }}>Open full profile →</Link>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
                          <span>Uploads 7d: <strong>{fmtNum(r.uploads7d)}</strong></span>
                          <span>Conversions 7d: <strong>{fmtNum(r.conversions7d)}</strong></span>
                          <span>Active days: <strong>{r.activeDays ?? '—'}</strong></span>
                          <span>Total events: <strong>{fmtNum(r.events)}</strong></span>
                          {r.current_device && <span>Device: <strong>{r.current_device}</strong></span>}
                          {r.current_ip && <span>IP: <strong className="mono">{r.current_ip}</strong></span>}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Upload mix: {topTypes(r.uploadsByType, 6)} · Conversion mix: {topTypes(r.conversionsByType, 6)}</div>
                        </div>
                        {(recent[r.id] || []).length === 0 && <div style={{ color: 'var(--muted)', marginTop: 6 }}>Loading activity…</div>}
                        {(recent[r.id] || []).map((e, i) => (
                          <FormattedEvent key={i} event={e} />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {view.length === 0 && (
              <tr><td colSpan={9}><div className="empty">No users match.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page + 1} of {pages}</span>
        <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
