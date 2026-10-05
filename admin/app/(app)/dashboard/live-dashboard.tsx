'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  GrowthChart,
  ConversionsChart,
  TokensChart,
  UploadsChart,
  UploadTypesChart,
  ComparisonChart,
  FunnelChart
} from './charts';
import type {
  Cards,
  DayBucket,
  FunnelStep,
  PeriodComparison,
  RetentionCohort,
  UserActivityDetail
} from '@/lib/metrics';

export interface DashboardData {
  totalUsers: number;
  eventsCount: number;
  cards: Cards;
  series30: DayBucket[];
  week: PeriodComparison;
  month: PeriodComparison;
  uploadTypes: Record<string, number>;
  funnel: FunnelStep[];
  topUsers: UserActivityDetail[];
  retention: RetentionCohort[];
  byType: Array<[string, number]>;
}

function fmt(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US');
}

function deltaBadge(pct: number): { text: string; cls: string } {
  if (!Number.isFinite(pct) || pct === 0) return { text: '±0%', cls: 'pill' };
  const arrow = pct > 0 ? '▲' : '▼';
  const cls = pct > 0 ? 'pill pro' : 'pill';
  const sign = pct > 0 ? '+' : '';
  return { text: `${arrow} ${sign}${pct}%`, cls };
}

export function LiveDashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initial);
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/metrics?days=30', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const byType = Object.entries(json.cards?.bySourceType || {}).sort(
        (a: any, b: any) => b[1] - a[1]
      ) as Array<[string, number]>;

      setData({
        totalUsers: json.totalUsers ?? json.cards?.totalUsers ?? 0,
        eventsCount: json.eventsCount ?? 0,
        cards: json.cards,
        series30: json.series,
        week: json.week || json.comparison?.[0],
        month: json.month || json.comparison?.[1],
        uploadTypes: json.uploadTypes || {},
        funnel: json.funnel || [],
        topUsers: json.topUsers || [],
        retention: json.retention || [],
        byType
      });
      setLastUpdated(new Date());
    } catch {
      /* ignore background poll errors */
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, 5000); // 5-second real-time polling
    return () => clearInterval(interval);
  }, [isLive, fetchMetrics]);

  const cards = data.cards;
  const week = data.week;
  const month = data.month;

  const wSign = deltaBadge(week?.pctChange?.signups ?? 0);
  const wActive = deltaBadge(week?.pctChange?.activeUsers ?? 0);
  const wUploads = deltaBadge(week?.pctChange?.uploads ?? 0);
  const wConv = deltaBadge(week?.pctChange?.conversions ?? 0);
  const mSign = deltaBadge(month?.pctChange?.signups ?? 0);

  const convRate =
    !cards || cards.uploads30d === 0
      ? 0
      : Math.round(((cards.conversions30d || 0) / (cards.uploads30d || 1)) * 1000) / 10;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>
            One-view activity monitor · {data.totalUsers} user accounts · {fmt(data.eventsCount)} events tracked · uploads &amp; conversion types only
          </p>
        </div>

        {/* Real-time controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper)', border: '1px solid var(--hairline)', padding: '6px 12px', borderRadius: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isLive ? '#2e6b3e' : '#9e2b25',
                display: 'inline-block',
                boxShadow: isLive ? '0 0 0 3px rgba(46, 107, 62, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            />
            <span style={{ color: isLive ? '#2e6b3e' : 'var(--muted)' }}>
              {isLive ? 'LIVE (5s)' : 'PAUSED'}
            </span>
          </div>

          <span style={{ color: 'var(--hairline)' }}>|</span>

          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsLive(!isLive)}
            style={{ fontSize: 11, padding: '2px 6px', fontWeight: 600, color: 'var(--ink)' }}
            title={isLive ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {isLive ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fetchMetrics()}
            disabled={isRefreshing}
            style={{ fontSize: 11, padding: '2px 6px', fontWeight: 600, color: 'var(--crimson)', opacity: isRefreshing ? 0.5 : 1 }}
            title="Refresh now"
          >
            {isRefreshing ? '↻ …' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="k">Total users</div>
          <div className="v">{fmt(data.totalUsers)}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span className={wSign.cls}>{wSign.text} 7d</span>
            <span className={mSign.cls}>{mSign.text} 30d</span>
          </div>
        </div>
        <div className="card">
          <div className="k">New signups · 7d</div>
          <div className="v"><em>{fmt(cards.newSignups7d)}</em></div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
            prior 7d: {fmt(week?.previous?.signups || 0)}
          </div>
        </div>
        <div className="card">
          <div className="k">Active users · 7d</div>
          <div className="v">{fmt(cards.activeUsers7d)}</div>
          <div style={{ marginTop: 6 }}>
            <span className={wActive.cls}>{wActive.text} vs prior 7d</span>
          </div>
        </div>
        <div className="card">
          <div className="k">Uploads · 30d</div>
          <div className="v">{fmt(cards.uploads30d)}</div>
          <div style={{ marginTop: 6 }}>
            <span className={wUploads.cls}>{wUploads.text} last 7d</span>
          </div>
        </div>
        <div className="card">
          <div className="k">Conversions · 30d</div>
          <div className="v">{fmt(cards.conversions30d)}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={wConv.cls}>{wConv.text} 7d</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{convRate}% rate</span>
          </div>
        </div>
        <div className="card">
          <div className="k">Tokens saved · 30d</div>
          <div className="v">{fmt(cards.tokensSaved30d)}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
            {fmt(cards.conversions7d)} conversions in last 7d
          </div>
        </div>
      </div>

      {/* Week vs month growth */}
      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Growth · this 7d vs prior 7d</h2>
          {week && <ComparisonChart data={week} />}
        </div>
        <div className="card">
          <h2 className="panel-title">Growth · this 30d vs prior 30d</h2>
          {month && <ComparisonChart data={month} />}
        </div>
      </div>

      {/* Trends */}
      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">User growth · 30d</h2>
          <GrowthChart data={data.series30} />
        </div>
        <div className="card">
          <h2 className="panel-title">Uploads vs conversions · per day</h2>
          <UploadsChart data={data.series30} />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Conversions per day · 30d</h2>
          <ConversionsChart data={data.series30} />
        </div>
        <div className="card">
          <h2 className="panel-title">Tokens saved · 30d</h2>
          <TokensChart data={data.series30} />
        </div>
      </div>

      {/* Upload mix + funnel */}
      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Upload &amp; conversion mix · 30d</h2>
          <UploadTypesChart data={data.uploadTypes} />
          {data.byType.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {data.byType.map(([t, n]) => (
                <span
                  key={t}
                  className="label-sm"
                  style={{ border: '1px solid #e7dccf', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}
                >
                  {t.toUpperCase()} · {fmt(n)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="panel-title">Conversion funnel · 30d</h2>
          <FunnelChart data={data.funnel} />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Uploads → started → completed → downloaded / copied. Drop-off between started and done usually means file errors.
          </p>
        </div>
      </div>

      {/* Top users + retention */}
      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Top users · by conversions (all time)</h2>
          {data.topUsers.length === 0 ? (
            <div className="empty">No user activity yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr><th>User</th><th>Uploads</th><th>Conv.</th><th>Rate</th><th>Tokens</th></tr>
                </thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.email || u.userId.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {Object.entries(u.uploadsByType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${t}:${n}`).join(' · ') || '—'}
                        </div>
                      </td>
                      <td>{fmt(u.totalUploads)}</td>
                      <td>{fmt(u.totalConversions)}</td>
                      <td>{u.conversionRate}%</td>
                      <td>{fmt(u.totalTokensSaved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="panel-title">Retention · weekly cohorts (% active)</h2>
          {data.retention.length === 0 ? (
            <div className="empty">Not enough history for cohorts yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr><th>Cohort</th><th>n</th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr>
                </thead>
                <tbody>
                  {data.retention.map((c) => (
                    <tr key={c.cohort}>
                      <td className="mono">{c.cohort}</td>
                      <td>{c.size}</td>
                      <td>{c.week0}%</td>
                      <td>{c.week1}%</td>
                      <td>{c.week2}%</td>
                      <td>{c.week3}%</td>
                      <td>{c.week4}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            W0 = signed-up week. Healthy: W1 &gt; 30%.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <h2 className="panel-title">How to read this page</h2>
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>· <strong>Real-time updates</strong>: This dashboard polls and refreshes all metrics and charts every 5 seconds. You can pause or manually refresh at any time.</span>
          <span>· <strong>Uploads &amp; Conversions</strong>: File selection, conversion starts, completions, and token savings are reflected in real time.</span>
          <span>· <strong>Single-browser rule</strong> is enforced: a new sign-in revokes the previous browser session. Check the Users and Security pages for per-user sessions.</span>
        </div>
      </div>
    </div>
  );
}
