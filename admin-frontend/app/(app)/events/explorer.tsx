'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface Row {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string | null;
  platform: string | null;
  created_at: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
}

function shortId(id: unknown): string {
  const s = String(id || '');
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}

export function EventsExplorer({ initial, eventTypes }: { initial: Row[]; eventTypes: string[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [event, setEvent] = useState('');
  const [platform, setPlatform] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedJson, setExpandedJson] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function apply(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (event) params.set('event', event);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setRows(data.events || []);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (platform) {
      list = list.filter((r) => (r.platform || '').toLowerCase() === platform.toLowerCase());
    }
    return list;
  }, [rows, platform]);

  function toggleRaw(id: string) {
    setExpandedJson((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function copyJson(id: string, props: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(props, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch { /* ignore */ }
  }

  function renderEventBadge(name: string) {
    switch (name) {
      case 'convert_success':
        return (
          <span className="pill pro" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span style={{ fontSize: 9 }}>✓</span> Conversion Succeeded
          </span>
        );
      case 'convert_error':
        return (
          <span className="pill" style={{ background: '#fbe9e4', color: '#9e2b25', borderColor: '#eec5bf', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span style={{ fontSize: 9 }}>✕</span> Conversion Failed
          </span>
        );
      case 'signin':
        return (
          <span className="pill" style={{ background: '#e8f0fe', color: '#1a73e8', borderColor: '#d2e3fc', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>🔑</span> Sign In
          </span>
        );
      case 'signout':
        return (
          <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>🚪</span> Sign Out
          </span>
        );
      case 'security_admin_action':
        return (
          <span className="pill" style={{ background: 'var(--crimson-tint)', color: 'var(--crimson-deep)', borderColor: 'var(--crimson-tint-2)', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>🛡️</span> Security Admin Action
          </span>
        );
      case 'file_select':
        return (
          <span className="pill" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>📄</span> File Selected
          </span>
        );
      case 'convert_start':
        return (
          <span className="pill" style={{ background: '#f3e8ff', color: '#6b21a8', borderColor: '#e9d5ff', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>⚙️</span> Convert Started
          </span>
        );
      case 'copy':
        return (
          <span className="pill" style={{ background: '#e6fffa', color: '#234e52', borderColor: '#b2f5ea', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>📋</span> Copied
          </span>
        );
      case 'download':
        return (
          <span className="pill" style={{ background: '#e6fffa', color: '#234e52', borderColor: '#b2f5ea', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px' }}>
            <span>📥</span> Downloaded
          </span>
        );
      default:
        return <span className="pill mono">{name}</span>;
    }
  }

  function renderPlatformBadge(p: string | null) {
    if (!p) return <span style={{ color: 'var(--muted)' }}>—</span>;
    const lower = p.toLowerCase();
    if (lower === 'extension') {
      return (
        <span className="pill" style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 600 }}>
          🧩 Extension
        </span>
      );
    }
    if (lower === 'admin') {
      return (
        <span className="pill" style={{ fontSize: 11, background: '#f5f3ff', color: '#5b21b6', borderColor: '#ddd6fe', fontWeight: 600 }}>
          ⚡ Admin
        </span>
      );
    }
    return <span className="pill">{p}</span>;
  }

  function renderSummaryChips(r: Row) {
    const p = (r.properties || {}) as Record<string, unknown>;

    switch (r.event_name) {
      case 'convert_success': {
        const src = String(p.source_type || 'doc').toUpperCase();
        const ms = typeof p.ms === 'number' ? (p.ms / 1000).toFixed(1) + 's' : null;
        const ocr = p.ocr_used ? '⚡ OCR' : null;
        const tokens = typeof p.tokens_saved === 'number'
          ? (p.tokens_saved >= 0 ? `+${p.tokens_saved.toLocaleString('en-US')} saved` : `${p.tokens_saved} tokens`)
          : null;
        const preset = p.preset ? `Model: ${p.preset}` : null;
        const mode = p.mode ? `Mode: ${p.mode}` : null;

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, background: 'var(--paper-2)', padding: '2px 8px', borderRadius: 4, fontSize: 11, border: '1px solid var(--hairline)' }}>
              {src}
            </span>
            {ms && <span style={{ color: 'var(--muted)', fontSize: 11 }}>in {ms}</span>}
            {ocr && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{ocr}</span>}
            {tokens && (
              <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: typeof p.tokens_saved === 'number' && p.tokens_saved >= 0 ? 'var(--ok)' : 'inherit' }}>
                {tokens}
              </span>
            )}
            {preset && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: 'var(--muted)' }}>{preset}</span>}
            {mode && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: 'var(--muted)' }}>{mode}</span>}
          </div>
        );
      }
      case 'security_admin_action': {
        const actionLabel = p.action === 'change_plan'
          ? 'Changed subscription plan'
          : p.action === 'reauth_grant'
          ? 'Granted session re-auth'
          : String(p.action || 'Admin Action');
        const admin = p.admin_id ? `Admin: ${shortId(p.admin_id)}` : null;

        return (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ fontSize: 12 }}>{actionLabel}</strong>
            {admin && <span style={{ color: 'var(--muted)', fontSize: 11 }} className="mono">{admin}</span>}
          </div>
        );
      }
      case 'signin': {
        const session = p.had_prior_session ? 'Existing session resumed' : 'New login session';
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <span>{session}</span>
          </div>
        );
      }
      case 'convert_error': {
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--err)', fontWeight: 600 }}>{String(p.errorCode || 'Conversion Error')}</span>
            {Boolean(p.message) && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{String(p.message)}</span>}
          </div>
        );
      }
      case 'file_select':
      case 'convert_start': {
        const src = p.source_type ? String(p.source_type).toUpperCase() : null;
        const mode = p.mode ? `Mode: ${p.mode}` : null;
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {src && <span style={{ fontWeight: 600, background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{src}</span>}
            {mode && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{mode}</span>}
          </div>
        );
      }
      default: {
        const entries = Object.entries(p).filter(([k]) => !['at', 'client_version'].includes(k)).slice(0, 4);
        if (entries.length === 0) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entries.map(([k, v]) => (
              <span key={k} style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: 'var(--muted)' }}>
                {k}: <strong style={{ color: 'var(--ink)' }}>{String(v)}</strong>
              </span>
            ))}
          </div>
        );
      }
    }
  }

  return (
    <div>
      <form onSubmit={apply} className="toolbar" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Event name">
            <option value="">All events</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
            <option value="">All platforms</option>
            <option value="extension">Extension</option>
            <option value="admin">Admin Portal</option>
          </select>
          <input
            placeholder="Search properties or user…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search events"
            style={{ minWidth: 200 }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy}>
            {busy ? 'Filtering…' : 'Filter'}
          </button>
          {(event || platform || q) && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '6px 8px' }}
              onClick={() => {
                setEvent('');
                setPlatform('');
                setQ('');
                setRows(initial);
              }}
            >
              Reset
            </button>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
        </span>
      </form>

      <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--paper)' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 180 }}>Time</th>
              <th style={{ width: 170 }}>Event</th>
              <th style={{ width: 200 }}>User</th>
              <th style={{ width: 110 }}>Platform</th>
              <th>Properties &amp; Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top', paddingTop: 11 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{fmtDate(r.created_at)}</div>
                </td>
                <td style={{ verticalAlign: 'top', paddingTop: 10 }}>
                  {renderEventBadge(r.event_name)}
                </td>
                <td style={{ verticalAlign: 'top', paddingTop: 11, maxWidth: 200 }}>
                  {r.user_email ? (
                    r.user_id ? (
                      <Link
                        href={`/users/${r.user_id}`}
                        style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                        title="View user profile"
                      >
                        {r.user_email}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{r.user_email}</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>anonymous</span>
                  )}
                </td>
                <td style={{ verticalAlign: 'top', paddingTop: 10 }}>
                  {renderPlatformBadge(r.platform)}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      {renderSummaryChips(r)}
                      <button
                        type="button"
                        onClick={() => toggleRaw(r.id)}
                        style={{
                          background: expandedJson[r.id] ? 'var(--paper-2)' : 'transparent',
                          border: '1px solid var(--hairline)',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {expandedJson[r.id] ? 'Hide JSON' : '{ } Raw JSON'}
                      </button>
                    </div>

                    {expandedJson[r.id] && (
                      <div
                        style={{
                          background: '#1e1611',
                          color: '#f8f4ef',
                          padding: '10px 12px',
                          borderRadius: 8,
                          position: 'relative',
                          marginTop: 4
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => copyJson(r.id, r.properties)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            fontSize: 10,
                            fontWeight: 600,
                            background: copiedId === r.id ? '#2e6b3e' : 'rgba(255,255,255,0.18)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '3px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedId === r.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <pre
                          className="mono"
                          style={{
                            margin: 0,
                            fontSize: 11,
                            maxHeight: 180,
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.4
                          }}
                        >
                          {JSON.stringify(r.properties, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty">No events match the selected filters.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
