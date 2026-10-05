import { getStore, toPublic } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10) || 100));
  const event = url.searchParams.get('event') || undefined;
  const userId = url.searchParams.get('userId') || undefined;
  const q = url.searchParams.get('q') || undefined;

  const store = getStore();
  const events = await store.listEvents({ limit, event, userId, q });
  const users = await store.listUsers();
  const emails = new Map(users.map((u) => [u.id, u.email]));
  return json({
    events: events.map((e) => ({
      ...e,
      user_email: e.user_id ? emails.get(e.user_id) || null : null
    }))
  });
}
