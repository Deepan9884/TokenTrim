'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export default function ForgotPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/api/auth/forgot', { email });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/api/auth/reset', { email, pin, newPassword });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      {step === 1 ? (
        <form className="auth-card" onSubmit={submitEmail}>
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo-icon.svg" alt="TokenTrim" width={24} height={24} style={{ width: 24, height: 24 }} />
            <span>Token<em>Trim</em> Creator</span>
          </div>
          <p className="auth-sub">Enter your account email to continue.</p>
          {error && <div className="form-err" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <div className="auth-links">
            <Link href="/login">Back to sign in</Link>
            <span />
          </div>
        </form>
      ) : (
        <form className="auth-card" onSubmit={submitReset}>
          <div className="brand">Token<em>Trim</em> Creator</div>
          <p className="auth-sub">Enter the 4-digit key from signup, then choose a new password.</p>
          {error && <div className="form-err" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="pin">4-digit key</label>
            <input id="pin" type="text" inputMode="numeric" maxLength={4} placeholder="1234" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password (min 8 characters)</label>
            <div className="password-input-wrapper">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="m644-428-58-58q9-47-27-88t-87-26l-58-58q19-8 39.5-12t40.5-4q75 0 127.5 52.5T680-500q0 20-4 40.5T664-420l-20-8Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t88-8.5q146 0 266 81.5T920-500q-32 80-88.5 143.5T772-302Zm20 230L626-238q-35 18-72 27t-74 9q-146 0-266-81.5T40-500q33-82 89.5-146T262-750l-190-190 51-51 777 777-51 51Zm-312-386Zm-160 84 56 56q3 0 5.5-1.5T384-472l-42-42q-2 2-2 4Zm160 160q21 0 40.5-4.5T528-278l-44-44q-1 0-2 .5t-2 .5q-45 0-76.5-31.5T372-430q0-1 .5-2t.5-2l-44-44q-6 9-10.5 28.5T314-410q0 75 52.5 127.5T480-230Zm-206-88q-44-24-81.5-58.5T128-500q50-101 144.5-160.5T480-720q19 0 37.5 2t36.5 6l-66 66q-4-1-8-1.5t-8-.5q-75 0-127.5 52.5T300-500q0 4 .5 8t1.5 8l-68 68q-10-8-19-17.5T196-454l78 76Z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-480Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
          <div className="auth-links">
            <button type="button" className="btn-ghost" onClick={() => { setStep(1); setError(''); }}>Back</button>
            <Link href="/login">Sign in</Link>
          </div>
        </form>
      )}
    </div>
  );
}
