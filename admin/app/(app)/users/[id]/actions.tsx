'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ManagePlanButton } from '../PlanModal';

export function UserActions({ userId, userEmail, plan, planExpiresAt }: {
  userId: string;
  userEmail: string;
  plan: string;
  planExpiresAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [newPin, setNewPin] = useState('');

  async function call(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : '{}'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Action failed.');
    return data;
  }

  async function revoke() {
    if (!confirm('Revoke all browser sessions for this user? They will be signed out everywhere.')) return;
    setBusy('revoke'); setMsg('');
    try {
      const d = await call(`/api/admin/users/${userId}/revoke`);
      setMsg(`Revoked ${d.revoked ?? 0} session(s). User must sign in again.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy('');
    }
  }

  function onPlanSaved(message: string) {
    setMsg(message);
    router.refresh();
  }

  async function resetPin(e: React.FormEvent) {
    e.preventDefault();
    setBusy('pin'); setMsg('');
    try {
      await call(`/api/admin/users/${userId}/pin`, { pin: newPin });
      setMsg('PIN reset. Share the new 4-digit key with the user over a trusted channel.');
      setNewPin('');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={revoke} disabled={!!busy}>
          {busy === 'revoke' ? 'Revoking…' : 'Revoke all sessions'}
        </button>
        <ManagePlanButton
          userId={userId}
          userEmail={userEmail}
          currentPlan={plan}
          currentExpiresAt={planExpiresAt}
          onSaved={onPlanSaved}
        />
      </div>
      <form onSubmit={resetPin} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="New 4-digit key"
          inputMode="numeric"
          aria-label="New PIN"
          style={{ font: 'inherit', fontSize: 13, padding: '8px 10px', border: '1px solid var(--hairline)', borderRadius: 9, width: 160 }}
        />
        <button className="btn" style={{ width: 'auto', border: '1px solid var(--hairline)', background: '#fff' }} type="submit" disabled={!!busy || newPin.length !== 4}>
          {busy === 'pin' ? 'Saving…' : 'Reset key'}
        </button>
      </form>
      {msg && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>{msg}</div>}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
        Every action is written to the audit log with your identity, IP, and timestamp.
      </p>
    </div>
  );
}
