import { getStore, toPublic } from '@/lib/store';
import { computeUserActivityDetails } from '@/lib/metrics';
import { UsersTable } from './table';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const store = getStore();
  const allUsers = await store.listUsers();
  const users = allUsers.filter((u) => !u.is_admin);
  const events = await store.listEvents({ limit: 20000 });
  const details = computeUserActivityDetails(
    users.map((u) => ({ id: u.id, created_at: u.created_at, email: u.email, name: u.name, plan: u.plan, last_login_at: u.last_login_at })),
    events
  );
  const byId = new Map(details.map((d) => [d.userId, d]));

  const rows = users.map((u) => {
    const d = byId.get(u.id);
    return {
      ...toPublic(u),
      plan_expires_at: u.plan_expires_at || null,
      uploads: d?.totalUploads || 0,
      uploadsByType: d?.uploadsByType || {},
      conversions: d?.totalConversions || 0,
      conversionsByType: d?.conversionsByType || {},
      conversionRate: d?.conversionRate || 0,
      uploads7d: d?.uploads7d || 0,
      conversions7d: d?.conversions7d || 0,
      tokensSaved: d?.totalTokensSaved || 0,
      events: d?.totalEvents || 0,
      activeDays: d?.activeDays || 0,
      trend7d: d?.trend7d || 'flat',
      lastSeen: d?.lastSeen || u.last_login_at
    };
  });

  const active7d = rows.filter((r) => (r.uploads7d + r.conversions7d) > 0).length;

  return (
    <div>
      <h1 className="page-title">Users</h1>
      <p className="page-sub">
        {rows.length} accounts · {active7d} active in last 7d · counts &amp; types only, never file contents · click a row for recent activity, open full profile for sessions &amp; security
      </p>
      <div className="card">
        <UsersTable rows={rows} />
      </div>
    </div>
  );
}
