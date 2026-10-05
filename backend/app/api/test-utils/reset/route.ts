import { getStore, isDemoStore } from '@/lib/store';
import { json } from '@/lib/session';

export const dynamic = 'force-dynamic';

function allowed(): boolean {
  return process.env.ALLOW_TEST_ENDPOINTS === 'true' && isDemoStore();
}

/** Wipe demo data (tests only — 404 unless explicitly enabled). */
export async function POST() {
  if (!allowed()) return json({ error: 'Not found.' }, 404);
  await getStore().resetForTests();
  return json({ ok: true });
}
