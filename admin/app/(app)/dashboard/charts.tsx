'use client';

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import type { DayBucket, FunnelStep, PeriodComparison } from '@/lib/metrics';

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtNum(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US');
}

const tipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7dccf',
  borderRadius: '9px',
  fontSize: 12
} as const;

export function GrowthChart({ data }: { data: DayBucket[] }) {
  const rows = data.map((d) => ({ ...d, day: shortDate(d.date) }));
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece5db" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e7dccf' }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="signups" name="Signups" stroke="#c1121f" fill="#fbe9eb" strokeWidth={2} />
          <Area type="monotone" dataKey="activeUsers" name="Active users" stroke="#6e6259" fill="#efe7dc" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConversionsChart({ data }: { data: DayBucket[] }) {
  const rows = data.map((d) => ({ ...d, day: shortDate(d.date) }));
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece5db" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e7dccf' }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tipStyle} />
          <Bar dataKey="conversions" name="Conversions" fill="#c1121f" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TokensChart({ data }: { data: DayBucket[] }) {
  const rows = data.map((d) => ({ ...d, day: shortDate(d.date) }));
  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece5db" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e7dccf' }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}`)} />
          <Tooltip contentStyle={tipStyle} formatter={(v: number | string) => [fmtNum(v), 'Tokens saved']} />
          <Line type="monotone" dataKey="tokensSaved" name="Tokens saved" stroke="#c1121f" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UploadsChart({ data }: { data: DayBucket[] }) {
  const rows = data.map((d) => ({ ...d, day: shortDate(d.date) }));
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece5db" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e7dccf' }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="uploads" name="Uploads" fill="#6e6259" radius={[5, 5, 0, 0]} />
          <Bar dataKey="conversions" name="Conversions" fill="#c1121f" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PIE_COLORS = ['#c1121f', '#6e6259', '#b08968', '#7f5539', '#9c6644', '#e07a5f', '#3d405b', '#81b29d', '#f2cc8f'];

export function UploadTypesChart({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data)
    .map(([name, value]) => ({ name: name.toUpperCase(), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 9);
  if (rows.length === 0) return <div className="empty">No upload data yet.</div>;
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" outerRadius={88} innerRadius={44} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonChart({ data }: { data: PeriodComparison }) {
  const rows = [
    { k: 'Signups', cur: data.current.signups, prev: data.previous.signups },
    { k: 'Active', cur: data.current.activeUsers, prev: data.previous.activeUsers },
    { k: 'Uploads', cur: data.current.uploads, prev: data.previous.uploads },
    { k: 'Conv.', cur: data.current.conversions, prev: data.previous.conversions }
  ];
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece5db" />
          <XAxis dataKey="k" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e7dccf' }} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="prev" name={data.period === '7d' ? 'Prior 7d' : 'Prior 30d'} fill="#d8cfc4" radius={[5, 5, 0, 0]} />
          <Bar dataKey="cur" name={data.period === '7d' ? 'This 7d' : 'This 30d'} fill="#c1121f" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChart({ data }: { data: FunnelStep[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((s) => (
        <div key={s.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            <span style={{ color: 'var(--muted)' }}>{fmtNum(s.count)} · {s.rate}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: '#f1e9de', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, Math.round((s.count / max) * 100))}%`, height: '100%', background: '#c1121f', borderRadius: 999 }} />
          </div>
        </div>
      ))}
      {data.every((d) => d.count === 0) && <div className="empty">No funnel data in this window.</div>}
    </div>
  );
}
