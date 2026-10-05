import { getStore } from '@/lib/store';
import { EventsExplorer } from './explorer';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const store = getStore();
  const initial = await store.listEvents({ limit: 100 });
  const users = await store.listUsers();
  const emails = new Map(users.map((u) => [u.id, u.email]));
  const eventTypes = [...new Set(initial.map((e) => e.event_name))].sort();

  return (
    <div>
      <h1 className="page-title">Events</h1>
      <p className="page-sub">Every tracked action, newest first</p>
      <div className="card">
        <EventsExplorer
          initial={initial.map((e) => ({ ...e, user_email: e.user_id ? emails.get(e.user_id) || null : null }))}
          eventTypes={eventTypes}
        />
      </div>
    </div>
  );
}
