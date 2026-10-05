import { getStore, toPublic } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';
import { computeUserActivityDetails } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);
  const { id } = await ctx.params;

  const store = getStore();
  const user = await store.findUserById(id);
  if (!user || user.is_admin) return json({ error: 'User not found.' }, 404);

  const events = await store.listEvents({ limit: 500, userId: id });
  const [detail] = computeUserActivityDetails(
    [{ id: user.id, created_at: user.created_at, email: user.email, name: user.name, plan: user.plan, last_login_at: user.last_login_at }],
    events
  );
  let sessions: unknown[] = [];
  try {
    sessions = await store.listUserSessions(id);
  } catch { sessions = []; }

  return json({
    user: toPublic(user),
    activity: detail || null,
    events: events.slice(0, 100),
    sessions
  });
}
