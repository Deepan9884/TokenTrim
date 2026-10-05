import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';
import {
  bucketize,
  computeCards,
  computePeriodComparison,
  computeFunnel,
  uploadsByTypeTotals,
  computeUserActivityDetails,
  topUsersByConversions,
  computeRetention
} from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '30', 10) || 30));

  const store = getStore();
  const users = await store.listUsers();
  const nonAdmin = users.filter((u) => !u.is_admin);
  const all = await store.listEvents({ limit: 20000 });
  const details = computeUserActivityDetails(nonAdmin, all);
  const comparison = computePeriodComparison(nonAdmin, all);

  return json({
    days,
    totalUsers: nonAdmin.length,
    eventsCount: all.length,
    series: bucketize(nonAdmin, all, days),
    cards: computeCards(nonAdmin, all),
    comparison,
    week: comparison[0],
    month: comparison[1],
    funnel: computeFunnel(all, new Date(), days),
    uploadTypes: uploadsByTypeTotals(all, new Date(), days),
    topUsers: topUsersByConversions(details, 8),
    retention: computeRetention(nonAdmin, all),
    eventTypes: [...new Set(all.slice(0, 500).map((e) => e.event_name))].sort(),
    timestamp: new Date().toISOString()
  });
}
