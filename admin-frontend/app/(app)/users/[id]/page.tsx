import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore, toPublic } from '@/lib/store';
import { computeUserActivityDetails } from '@/lib/metrics';
import { UserActions } from './actions';
import { FormattedEvent } from '@/lib/event-formatter';

export const dynamic = 'force-dynamic';

function fmt(n: number): string {
  return Number(n || 0).toLocaleString('en-US');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const user = await store.findUserById(id);
  if (!user || user.is_admin) notFound();

  const events = await store.listEvents({ limit: 500, userId: id });
  const [detail] = computeUserActivityDetails(
    [{ id: user.id, created_at: user.created_at, email: user.email, name: user.name, plan: user.plan, last_login_at: user.last_login_at }],
    events
  );
  let sessions: Array<{ device: string | null; ip: string | null; created_at: string; expires_at: string; revoked_at: string | null; revoke_reason: string | null }> = [];
  try {
    sessions = await store.listUserSessions(id) as typeof sessions;
  } catch { sessions = []; }

  const uploads = Object.entries(detail?.uploadsByType || {}).sort((a, b) => b[1] - a[1]);
  const conversions = Object.entries(detail?.conversionsByType || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <Link href="/users" style={{ fontSize: 13 }}>← All users</Link>
      <h1 className="page-title" style={{ marginTop: 8 }}>{user.email}</h1>
      <p className="page-sub">
        {user.name || '—'} · <span className={user.plan === 'pro' ? 'pill pro' : 'pill'}>{user.plan}</span>
        {user.plan === 'pro' && (
          <span style={{ fontSize: 12 }}>
            {' '}· {user.plan_expires_at ? `expires ${fmtDate(user.plan_expires_at)}` : 'perpetual'}
          </span>
        )}{' '}
        {user.force_reauth
          ? <span className="pill" style={{ background: '#fbe9e4', borderColor: '#eec5bf', color: '#9e2b25' }}>re-auth required</span>
          : <span className="pill" style={{ background: '#e6f2e8', borderColor: '#c4dfc9', color: '#2e6b3e' }}>single session OK</span>}
        {' '}· signed up {fmtDate(user.created_at)} · last seen {fmtDate(detail?.lastSeen || user.last_login_at)}
      </p>

      <div className="cards">
        <div className="card"><div className="k">Uploads</div><div className="v">{fmt(detail?.totalUploads || 0)}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{fmt(detail?.uploads7d || 0)} in 7d</div></div>
        <div className="card"><div className="k">Conversions</div><div className="v"><em>{fmt(detail?.totalConversions || 0)}</em></div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{detail?.conversionRate || 0}% rate</div></div>
        <div className="card"><div className="k">Tokens saved</div><div className="v">{fmt(detail?.totalTokensSaved || 0)}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>avg {fmt(detail?.avgTokensPerConversion || 0)}/conv</div></div>
        <div className="card"><div className="k">Active days</div><div className="v">{fmt(detail?.activeDays || 0)}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{fmt(detail?.totalEvents || 0)} events</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Upload mix · what they upload</h2>
          {uploads.length === 0 ? <div className="empty">No uploads yet.</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uploads.map(([t, n]) => (
                <span key={t} style={{ border: '1px solid #e7dccf', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>{t.toUpperCase()} · {fmt(n)}</span>
              ))}
            </div>
          )}
          <h2 className="panel-title" style={{ marginTop: 14 }}>Conversion mix · what succeeds</h2>
          {conversions.length === 0 ? <div className="empty">No conversions yet.</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {conversions.map(([t, n]) => (
                <span key={t} style={{ border: '1px solid #e7dccf', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>{t.toUpperCase()} · {fmt(n)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="panel-title">Current session · single-browser</h2>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Device: <strong>{toPublic(user).current_device || user.current_device || '—'}</strong></span>
            <span>IP: <strong className="mono">{toPublic(user).current_ip || user.current_ip || '—'}</strong></span>
            <span>Started: <strong>{fmtDate(toPublic(user).current_started_at || user.current_started_at || null)}</strong></span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>A new sign-in from another browser revokes this session immediately.</span>
          </div>
          <h2 className="panel-title" style={{ marginTop: 14 }}>Creator controls</h2>
          <UserActions userId={user.id} userEmail={user.email} plan={user.plan} planExpiresAt={user.plan_expires_at || null} />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2 className="panel-title">Sessions · newest first (max 50)</h2>
          {sessions.length === 0 ? <div className="empty">No sessions recorded.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>Started</th><th>Device</th><th>IP</th><th>Status</th></tr></thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</td>
                      <td>{s.device || '—'}</td>
                      <td className="mono">{s.ip || '—'}</td>
                      <td>{s.revoked_at ? <span className="pill">revoked · {s.revoke_reason || 'unknown'}</span> : <span className="pill pro">live</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="panel-title">Activity timeline · newest first</h2>
          {events.length === 0 ? <div className="empty">No activity yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {events.slice(0, 60).map((e) => (
                <FormattedEvent key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
