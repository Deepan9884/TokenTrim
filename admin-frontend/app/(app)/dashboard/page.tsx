import { getStore } from '@/lib/store';
import {
  bucketize,
  computeCards,
  computePeriodComparison,
  computeUserActivityDetails,
  computeFunnel,
  computeRetention,
  topUsersByConversions,
  uploadsByTypeTotals
} from '@/lib/metrics';
import { LiveDashboard } from './live-dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const store = getStore();
  const users = await store.listUsers();
  const nonAdmin = users.filter((u) => !u.is_admin);
  const events = await store.listEvents({ limit: 20000 });
  const series30 = bucketize(nonAdmin, events, 30);
  const cards = computeCards(nonAdmin, events);
  const [week, month] = computePeriodComparison(nonAdmin, events);
  const details = computeUserActivityDetails(nonAdmin, events);
  const topUsers = topUsersByConversions(details, 8);
  const funnel = computeFunnel(events, new Date(), 30);
  const uploadTypes = uploadsByTypeTotals(events, new Date(), 30);
  const retention = computeRetention(nonAdmin, events);
  const byType = Object.entries(cards.bySourceType || {}).sort((a, b) => b[1] - a[1]);

  return (
    <LiveDashboard
      initial={{
        totalUsers: nonAdmin.length,
        eventsCount: events.length,
        cards,
        series30,
        week,
        month,
        uploadTypes,
        funnel,
        topUsers,
        retention,
        byType
      }}
    />
  );
}
