'use client';

import { useState } from 'react';

export interface EventItem {
  id?: string;
  event_name: string;
  created_at: string;
  properties?: Record<string, any> | null;
  user_id?: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FormattedEvent({ event, userEmail }: { event: EventItem; userEmail?: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const p = (event.properties || {}) as Record<string, any>;

  const renderContent = () => {
    switch (event.event_name) {
      case 'convert_success': {
        const ms = typeof p.ms === 'number' ? (p.ms / 1000).toFixed(1) + 's' : null;
        const src = String(p.source_type || 'Document').toUpperCase();
        const ocr = p.ocr_used ? '⚡ OCR Engine' : null;
        const tokens = typeof p.tokens_saved === 'number'
          ? (p.tokens_saved >= 0 ? `+${p.tokens_saved.toLocaleString()} tokens saved` : `${p.tokens_saved} tokens`)
          : null;
        const preset = p.preset ? `Model: ${p.preset}` : null;
        const mode = p.mode ? `Mode: ${p.mode}` : null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="pill pro" style={{ fontSize: 11, padding: '2px 8px' }}>Conversion Succeeded</span>
              <strong style={{ fontSize: 12 }}>{src}</strong>
              {ms && <span style={{ color: 'var(--muted)', fontSize: 12 }}>in {ms}</span>}
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
              {ocr && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4 }}>{ocr}</span>}
              {tokens && (
                <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4, color: p.tokens_saved >= 0 ? 'var(--ok)' : 'inherit' }}>
                  {tokens}
                </span>
              )}
              {preset && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4 }}>{preset}</span>}
              {mode && <span style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4 }}>{mode}</span>}
            </div>
          </div>
        );
      }
      case 'convert_error': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pill err" style={{ fontSize: 11, padding: '2px 8px' }}>Conversion Failed</span>
              <strong style={{ fontSize: 12, color: 'var(--err)' }}>{p.errorCode || 'Error'}</strong>
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
            {p.message && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{String(p.message)}</div>}
          </div>
        );
      }
      case 'signin': {
        const platform = p.platform === 'admin' ? 'Admin Dashboard' : 'Chrome Extension';
        const session = p.had_prior_session ? 'Existing session resumed' : 'New login session';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pill" style={{ fontSize: 11, padding: '2px 8px', background: '#e8f0fe', color: '#1a73e8', borderColor: '#d2e3fc' }}>User Sign-In</span>
              <strong style={{ fontSize: 12 }}>{platform}</strong>
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{session}</div>
          </div>
        );
      }
      case 'security_admin_action': {
        const actionName = p.action === 'change_plan' ? 'Changed user subscription plan' : (p.action || 'Admin Action');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pill" style={{ fontSize: 11, padding: '2px 8px', background: 'var(--crimson-tint)', color: 'var(--crimson-deep)', borderColor: 'var(--crimson-tint-2)' }}>Security Admin Action</span>
              <strong style={{ fontSize: 12 }}>{actionName}</strong>
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
            {p.admin_id && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Admin ID: <code className="mono">{String(p.admin_id).slice(0, 8)}…</code></div>}
          </div>
        );
      }
      case 'session_revoked': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pill err" style={{ fontSize: 11, padding: '2px 8px' }}>Session Revoked</span>
              <span style={{ fontSize: 12 }}>{p.reason || 'Revoked by admin'}</span>
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
          </div>
        );
      }
      default: {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pill" style={{ fontSize: 11, padding: '2px 8px' }}>{event.event_name}</span>
              {userEmail && <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {userEmail}</span>}
            </div>
            {Object.keys(p).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                {Object.entries(p).slice(0, 5).map(([k, v]) => (
                  <span key={k} style={{ background: 'var(--paper-2)', padding: '2px 6px', borderRadius: 4 }}>
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--paper)',
      border: '1px solid var(--hairline)',
      borderRadius: '8px',
      marginTop: '6px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>{renderContent()}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {fmtDate(event.created_at)}
          </span>
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 10,
              color: 'var(--muted)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showRaw ? 'Hide JSON' : 'Raw JSON'}
          </button>
        </div>
      </div>
      {showRaw && (
        <pre style={{
          margin: '6px 0 0',
          padding: '6px 8px',
          background: 'var(--paper-2)',
          borderRadius: '4px',
          fontSize: 10,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--ink)'
        }}>
          {JSON.stringify(p, null, 2)}
        </pre>
      )}
    </div>
  );
}
