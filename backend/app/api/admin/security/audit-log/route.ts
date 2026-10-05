import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10) || 100));
  const store = getStore();
  const logs = await store.listAuditLog(limit);
  const users = await store.listUsers();
  const emails = new Map(users.map((u) => [u.id, u.email]));
  return json({
    logs: logs.map((l) => ({
      ...l,
      admin_email: l.admin_id ? emails.get(l.admin_id) || null : null,
      target_email: l.target_user_id ? emails.get(l.target_user_id) || null : null
    }))
  });
}
