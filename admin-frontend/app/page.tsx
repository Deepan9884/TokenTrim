import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getStore } from '@/lib/store';

export default async function Home() {
  const jar = await cookies();
  const token = jar.get('tt_session')?.value;
  let authed = false;
  if (token) {
    try {
      authed = !!(await getStore().getSessionUser(token));
    } catch {
      authed = false;
    }
  }
  redirect(authed ? '/dashboard' : '/login');
}
