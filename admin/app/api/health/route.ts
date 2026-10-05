import { isDemoStore } from '@/lib/store';
import { json } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ ok: true, store: isDemoStore() ? 'demo' : 'supabase', time: new Date().toISOString() });
}
