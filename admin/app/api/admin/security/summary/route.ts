import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';
import { detectAnomalies } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const store = getStore();
  const overview = await store.securityOverview();
  const users = await store.listUsers();
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const events = await store.listEvents({ limit: 2000 });
  const anomalies = detectAnomalies(events, emailById);
  const securityEvents = events.filter((e) => e.event_name.startsWith('security_')).slice(0, 100);
  const forced = users.filter((u) => !u.is_admin && u.force_reauth).slice(0, 100);

  return json({ overview, anomalies: anomalies.slice(0, 100), securityEvents, forcedReauth: forced.map((u) => ({ id: u.id, email: u.email, name: u.name })) });
}
