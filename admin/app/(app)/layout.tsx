import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getStore } from '@/lib/store';
import { SignOutButton } from './signout-button';

async function currentUser() {
  const jar = await cookies();
  const token = jar.get('tt_session')?.value;
  if (!token) return { user: null, status: 'invalid' as const };
  try {
    return await getStore().getSessionUserWithStatus(token);
  } catch {
    return { user: null, status: 'invalid' as const };
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = await currentUser();
  if (!user) redirect(status === 'revoked_concurrent' ? '/login?revoked=1' : '/login');
  if (!user.is_admin) redirect('/login');

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-icon.svg" alt="TokenTrim" width={22} height={22} style={{ width: 22, height: 22 }} />
          <span>Token<em>Trim</em></span>
        </div>
        <Link className="nav-link" href="/dashboard">Dashboard</Link>
        <Link className="nav-link" href="/users">Users</Link>
        <Link className="nav-link" href="/events">Events</Link>
        <Link className="nav-link" href="/security">Security</Link>
        <div className="spacer" />
        <div className="who" title={user.email}>{user.email}</div>
        <SignOutButton />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
