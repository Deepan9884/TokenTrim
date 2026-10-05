'use client';

import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();
  async function signout() {
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }
  return (
    <button className="btn-ghost" style={{ textAlign: 'left', padding: '8px' }} onClick={signout}>
      Sign out
    </button>
  );
}
