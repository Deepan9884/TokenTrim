import { getStore, isDemoStore } from '@/lib/store';
import { json } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FIRST = ['Aarav', 'Mia', 'Leo', 'Sofia', 'Arjun', 'Emma', 'Vivaan', 'Ava', 'Kabir', 'Ishaan', 'Anaya', 'Rohan'];
const LAST = ['Sharma', 'Patel', 'Khan', 'Iyer', 'Gupta', 'Mehta', 'Rao', 'Das'];
const PRESETS = ['claude', 'chatgpt', 'gemini', 'local'];
const SOURCE_TYPES = ['pdf', 'pdf', 'pdf', 'docx', 'docx', 'pptx', 'image', 'xlsx', 'text', 'html'];

/** Deterministic demo dataset: admin + users + 14 days of events (tests only). */
export async function POST() {
  // Fail closed: never serve in production, never against a real database.
  // Requires explicit ALLOW_TEST_ENDPOINTS=true AND demo (JSON) store.
  if (process.env.NODE_ENV === 'production') {
    return json({ error: 'Not found.' }, 404);
  }
  if (!(process.env.ALLOW_TEST_ENDPOINTS === 'true' && isDemoStore())) {
    return json({ error: 'Not found.' }, 404);
  }
  const store = getStore();
  await store.resetForTests();

  const admin = await store.createUser({
    email: 'admin@tokentrim.local', name: 'Creator', password: 'admin123', pin: '1234', isAdmin: true
  });

  const users = [admin];
  for (let i = 0; i < 12; i++) {
    const u = await store.createUser({
      email: `user${i + 1}@example.com`,
      name: `${FIRST[i]} ${LAST[i % LAST.length]}`,
      password: `Password${i + 1}!`,
      pin: String(1000 + i),
      createdAt: new Date(Date.now() - i * 1.2 * 86400000).toISOString()
    });
    users.push(u);
  }

  // Events spread over the last 14 days with a rising trend
  const rows: Array<{ user_id: string | null; event_name: string; properties: Record<string, unknown>; session_id: string; client_version: string; platform: string; created_at: string }> = [];
  for (let d = 13; d >= 0; d--) {
    const day = new Date(Date.now() - d * 86400000);
    const volume = 14 - d; // rising trend: 1 → 14 conversions/day
    for (let k = 0; k < volume; k++) {
      const u = users[1 + ((d * 7 + k) % 12)];
      const at = new Date(day.getTime() + k * 3600000).toISOString();
      const sourceType = SOURCE_TYPES[(d + k) % SOURCE_TYPES.length];
      // Upload attempt first (what they upload), then conversion success (what kind converts)
      rows.push({
        user_id: u.id, event_name: 'file_select',
        properties: { source_type: sourceType },
        session_id: `seed-sess-${d}`, client_version: '1.1.0', platform: 'extension', created_at: at
      });
      if (k % 2 === 0) {
        rows.push({
          user_id: u.id, event_name: 'convert_start',
          properties: { source_type: sourceType, preset: PRESETS[(d + k) % 4] },
          session_id: `seed-sess-${d}`, client_version: '1.1.0', platform: 'extension', created_at: at
        });
      }
      rows.push({
        user_id: u.id, event_name: 'convert_success',
        properties: { tokens_saved: 800 + ((d * 13 + k * 71) % 4200), preset: PRESETS[(d + k) % 4], source_type: sourceType },
        session_id: `seed-sess-${d}`, client_version: '1.1.0', platform: 'extension', created_at: at
      });
      if (k % 3 === 0) {
        rows.push({
          user_id: u.id, event_name: 'copy', properties: {},
          session_id: `seed-sess-${d}`, client_version: '1.1.0', platform: 'extension', created_at: at
        });
      }
      if (k % 4 === 0) {
        rows.push({
          user_id: u.id, event_name: 'download', properties: { source_type: sourceType },
          session_id: `seed-sess-${d}`, client_version: '1.1.0', platform: 'extension', created_at: at
        });
      }
    }
    if (d % 4 === 0) {
      rows.push({
        user_id: null, event_name: 'file_select', properties: { source_type: 'pdf' },
        session_id: `seed-anon-${d}`, client_version: '1.1.0', platform: 'extension',
        created_at: new Date(day.getTime()).toISOString()
      });
    }
  }
  await store.insertEvents(rows);
  return json({ ok: true, users: users.length, events: rows.length });
}
