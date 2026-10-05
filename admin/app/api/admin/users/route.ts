import { getStore, toPublic } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const url = new URL(req.url);
  const includeAdmins = url.searchParams.get('includeAdmins') === 'true';

  const store = getStore();
  const allUsers = await store.listUsers();
  const users = includeAdmins ? allUsers : allUsers.filter((u) => !u.is_admin);
  const agg = await store.aggregates();
  return json({
    users: users.map((u) => {
      const a = agg.get(u.id);
      const uploads = a?.uploads || 0;
      const conversions = a?.conversions || 0;
      return {
        ...toPublic(u),
        uploads,
        uploadsByType: a?.uploadsByType || {},
        conversions,
        conversionsByType: a?.conversionsByType || {},
        conversionRate: uploads === 0 ? 0 : Math.round((conversions / uploads) * 1000) / 10,
        tokensSaved: a?.tokensSaved || 0,
        events: a?.events || 0,
        lastSeen: a?.lastSeen || u.last_login_at
      };
    })
  });
}
