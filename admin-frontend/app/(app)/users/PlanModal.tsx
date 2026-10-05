'use client';

import { useEffect, useState } from 'react';

export interface PlanModalProps {
  userId: string;
  userEmail: string;
  currentPlan: string;
  currentExpiresAt: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO → "YYYY-MM-DDTHH:MM" for <input type="datetime-local">. */
function toLocalInputValue(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  const d = Number.isFinite(t) ? new Date(t) : new Date(Date.now() + 30 * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtExpiry(iso: string | null): string {
  if (!iso) return 'perpetual';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'perpetual';
  const expired = d.getTime() <= Date.now();
  const s = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return expired ? `${s} (expired)` : s;
}

export function PlanModal({ userId, userEmail, currentPlan, currentExpiresAt, open, onClose, onSaved }: PlanModalProps) {
  const [plan, setPlan] = useState(currentPlan === 'pro' ? 'pro' : 'free');
  const [perpetual, setPerpetual] = useState(!currentExpiresAt);
  const [expiresLocal, setExpiresLocal] = useState(toLocalInputValue(currentExpiresAt));
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Reset whenever the modal opens (or the target user changes).
  useEffect(() => {
    if (!open) return;
    setPlan(currentPlan === 'pro' ? 'pro' : 'free');
    setPerpetual(!currentExpiresAt);
    setExpiresLocal(toLocalInputValue(currentExpiresAt));
    setAdminPassword('');
    setAdminPin('');
    setBusy(false);
    setErr('');
  }, [open, currentPlan, currentExpiresAt, userId]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function post(path: string, body: unknown, actionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (actionToken) headers['X-Admin-Action'] = actionToken;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Action failed.');
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (plan === 'free') {
        await post(`/api/admin/users/${userId}/plan`, { plan: 'free' });
        onSaved('Plan set to Free. Any Pro expiration was cleared.');
        onClose();
        return;
      }
      if (!adminPassword || adminPin.length !== 4) {
        throw new Error('Enter your password and 4-digit key to grant Pro.');
      }
      let expiresAt: string | null = null;
      if (!perpetual) {
        const t = Date.parse(expiresLocal);
        if (!Number.isFinite(t)) throw new Error('Pick a valid expiration date and time.');
        expiresAt = new Date(t).toISOString();
      }
      // Step 1: prove it is really you (password + PIN).
      const re = await post('/api/admin/reauth', { password: adminPassword, pin: adminPin });
      if (!re.actionToken) throw new Error('Verification did not return a token. Try again.');
      // Step 2: grant Pro with the single-use token (5-minute window).
      const saved = await post(`/api/admin/users/${userId}/plan`, { plan: 'pro', expires_at: expiresAt }, re.actionToken);
      onSaved(saved.expires_at ? `Pro granted until ${fmtExpiry(saved.expires_at)}.` : 'Pro granted (perpetual).');
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  // Compare expirations at minute precision (the picker has no seconds).
  const changed = plan !== currentPlan
    || (plan === 'pro' && (perpetual
      ? currentExpiresAt !== null
      : Math.floor((Date.parse(currentExpiresAt || '') || 0) / 60000)
        !== Math.floor((Date.parse(expiresLocal) || 0) / 60000)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Manage plan for ${userEmail}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(36,27,22,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 16, boxShadow: 'var(--shadow)', width: '100%', maxWidth: 460, padding: 22 }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>Manage plan</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
          <span className="mono">{userEmail}</span>
          {' · '}currently <span className={currentPlan === 'pro' ? 'pill pro' : 'pill'}>{currentPlan}</span>
          {currentPlan === 'pro' && <span style={{ fontSize: 12 }}> · {fmtExpiry(currentExpiresAt)}</span>}
        </p>

        {err && <div className="form-err" role="alert">{err}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Plan</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['free', 'pro'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  aria-pressed={plan === p}
                  style={{
                    flex: 1, font: 'inherit', fontSize: 14, fontWeight: 600, padding: '9px 0',
                    borderRadius: 9, cursor: 'pointer',
                    border: plan === p ? '2px solid var(--crimson)' : '1px solid var(--hairline)',
                    background: plan === p ? 'var(--crimson-tint)' : '#fff',
                    color: plan === p ? 'var(--crimson-ink)' : 'var(--muted)'
                  }}
                >{p === 'pro' ? 'Pro' : 'Free'}</button>
              ))}
            </div>
          </div>

          {plan === 'pro' && (
            <>
              <div className="field">
                <label htmlFor="pm-expires">Pro expires</label>
                <input
                  id="pm-expires"
                  type="datetime-local"
                  value={expiresLocal}
                  disabled={perpetual}
                  onChange={(e) => setExpiresLocal(e.target.value)}
                  style={{ opacity: perpetual ? 0.5 : 1 }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={perpetual} onChange={(e) => setPerpetual(e.target.checked)} />
                Perpetual Pro (no expiration)
              </label>
              <div style={{ background: 'var(--paper-2)', border: '1px solid var(--hairline)', borderRadius: 9, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Security check — prove it is you</div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label htmlFor="pm-password">Your admin password</label>
                  <input
                    id="pm-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    autoComplete="current-password"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="pm-pin">Your 4-digit key</label>
                  <input
                    id="pm-pin"
                    type="password"
                    inputMode="numeric"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    autoComplete="off"
                    style={{ maxWidth: 140, letterSpacing: 4 }}
                  />
                </div>
              </div>
            </>
          )}

          {plan === 'free' && currentPlan === 'pro' && (
            <div className="form-err" style={{ background: '#fff7e8', borderColor: '#ecd9ac', color: '#7a5b17' }}>
              Downgrading removes Pro immediately and clears any expiration date.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn-ghost btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !changed}>
              {busy ? 'Saving…' : plan === 'pro' ? 'Verify & grant Pro' : 'Downgrade to Free'}
            </button>
          </div>
        </form>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 0' }}>
          Pro grants are step-up verified and written to the audit log with your identity, IP, and timestamp.
        </p>
      </div>
    </div>
  );
}

export function ManagePlanButton({ userId, userEmail, currentPlan, currentExpiresAt, label, onSaved, style }: {
  userId: string;
  userEmail: string;
  currentPlan: string;
  currentExpiresAt: string | null;
  label?: string;
  onSaved?: (message: string) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ width: 'auto', border: '1px solid var(--hairline)', background: '#fff', ...(style || {}) }}
        onClick={() => setOpen(true)}
      >{label || 'Manage plan'}</button>
      <PlanModal
        userId={userId}
        userEmail={userEmail}
        currentPlan={currentPlan}
        currentExpiresAt={currentExpiresAt}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(m) => { onSaved?.(m); }}
      />
    </>
  );
}
