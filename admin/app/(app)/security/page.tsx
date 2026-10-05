import { getStore } from '@/lib/store';
import { detectAnomalies } from '@/lib/security';
import { FormattedEvent } from '@/lib/event-formatter';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('en-US');
}

export default async function SecurityPage() {
  const store = getStore();
  const overview = await store.securityOverview();
  const users = await store.listUsers();
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const events = await store.listEvents({ limit: 2000 });
  const anomalies = detectAnomalies(events, emailById);
  const securityEvents = events.filter((e) => e.event_name.startsWith('security_')).slice(0, 60);
  const audit = await store.listAuditLog(60);
  const forced = users.filter((u) => !u.is_admin && u.force_reauth);

  return (
    <div>
      <h1 className="page-title">Security</h1>
      <p className="page-sub">
        Single-browser enforcement · every sign-in from a new browser revokes the previous session · all creator actions are audit-logged
      </p>

      <div className="cards">
        <div className="card"><div className="k">Live sessions</div><div className="v">{fmtNum(overview.activeSessions)}</div></div>
        <div className="card"><div className="k">Revoked · 7d</div><div className="v"><em>{fmtNum(overview.revoked7d)}</em></div></div>
        <div className="card"><div className="k">Failed PIN · 7d</div><div className="v">{fmtNum(overview.failedPin7d)}</div></div>
        <div className="card"><div className="k">Needs re-auth</div><div className="v">{fmtNum(overview.forceReauthCount)}</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Anomalies · auto-detected</h2>
          {anomalies.length === 0 ? (
            <div className="empty">No anomalies. New-browser sign-ins, IP/device changes, and repeated PIN failures will appear here.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>Time</th><th>Type</th><th>User</th><th>Detail</th></tr></thead>
                <tbody>
                  {anomalies.slice(0, 40).map((a, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                      <td><span className="mono">{a.kind}</span></td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email || a.userId?.slice(0, 8) || '—'}</td>
                      <td>{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {forced.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h2 className="panel-title">Accounts waiting for re-auth ({forced.length})</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {forced.slice(0, 20).map((u) => (
                  <a key={u.id} href={`/users/${u.id}`} style={{ border: '1px solid #e7dccf', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>{u.email}</a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="panel-title">Security events · newest first</h2>
          {securityEvents.length === 0 ? (
            <div className="empty">No security events yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {securityEvents.map((e) => (
                <FormattedEvent key={e.id} event={e} userEmail={emailById.get(e.user_id || '') || 'anonymous'} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="panel-title">Creator audit log · who did what</h2>
        {audit.length === 0 ? (
          <div className="empty">No creator actions logged yet. Revokes, plan changes, and key resets appear here.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Time</th><th>Creator</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr></thead>
              <tbody>
                {audit.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emailById.get(l.admin_id || '') || l.admin_id?.slice(0, 8) || '—'}</td>
                    <td><span className="mono">{l.action}</span></td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.target_user_id ? emailById.get(l.target_user_id) || l.target_user_id.slice(0, 8) : '—'}</td>
                    <td><pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.details)}</pre></td>
                    <td className="mono">{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="panel-title">Enforcement rules (active)</h2>
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>· <strong>One browser at a time:</strong> any successful sign-in instantly revokes all other live sessions for that account.</span>
          <span>· <strong>Revoked browsers</strong> are signed out on their next request and shown a “signed in elsewhere” message.</span>
          <span>· <strong>Key protection:</strong> 5 wrong 4-digit keys in 15 minutes locks recovery; failures are logged per user.</span>
          <span>· <strong>Visibility:</strong> device + IP + timestamps are stored for the live session only — never passwords, keys, or file contents.</span>
        </div>
      </div>
    </div>
  );
}
