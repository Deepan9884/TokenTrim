import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';
import {
  bucketize, computeCards, computePeriodComparison,
  computeFunnel, computeRetention, computeUserActivityDetails,
  topUsersByConversions, uploadsByTypeTotals
} from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const store = getStore();
  const users = await store.listUsers();
  const events = await store.listEvents({ limit: 20000 });
  const nonAdmin = users.filter((u) => !u.is_admin);

  return json({
    series30: bucketize(users, events, 30),
    series7: bucketize(users, events, 7),
    cards: computeCards(users, events),
    comparison: computePeriodComparison(users, events),
    funnel: computeFunnel(events, new Date(), 30),
    retention: computeRetention(nonAdmin, events),
    uploadTypes: uploadsByTypeTotals(events, new Date(), 30),
    topUsers: topUsersByConversions(
      computeUserActivityDetails(
        nonAdmin.map((u) => ({ id: u.id, created_at: u.created_at, email: u.email, name: u.name, plan: u.plan })),
        events
      ),
      10
    )
  });
}
