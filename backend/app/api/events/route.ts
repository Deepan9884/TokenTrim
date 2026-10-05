import { getStore } from '@/lib/store';
import { json, sessionUser, clientIp } from '@/lib/session';
import { eventsAllowed, eventsRecorded } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'file_select', 'upload_start', 'upload_complete', 'upload_error',
  'convert_start', 'convert_success', 'convert_error',
  'copy', 'download', 'prompt_pack_copy', 'batch_start', 'batch_complete',
  'ocr_used', 'preset_changed', 'feedback_sent', 'onboarding_complete',
  'page_range_used', 'query_used', 'signup', 'signin', 'signout',
  'session_start', 'session_end', 'feature_used', 'error_occurred',
  'security_pin_failed', 'security_session_revoked', 'security_ip_changed',
  'security_device_changed', 'security_admin_action', 'security_login_failed'
]);

function cleanProps(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/.test(k)) continue;
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = Math.round(val * 1000) / 1000;
    else if (typeof val === 'string' && val.length <= 64) out[k] = val;
    else if (typeof val === 'boolean') out[k] = val;
  }
  return out;
}

/** Extension (Bearer token) and web (cookie) both land here. Auth REQUIRED. */
export async function POST(req: Request) {
  // ── Rate limiting (by IP) ──────────────────────────────────────────
  const ip = clientIp(req) || 'unknown';
  const gate = eventsAllowed(ip);
  if (!gate.ok) {
    return json({ error: 'Too many requests.' }, 429, { 'Retry-After': String(gate.retryAfterSec) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const raw = Array.isArray(body.events) ? body.events : [];
  if (raw.length > 500) return json({ error: 'Too many events (max 500).' }, 400);

  // Require authentication — reject anonymous event submissions
  const me = await sessionUser(req).catch(() => null);
  if (!me) {
    return json({ error: 'Authentication required.' }, 401);
  }

  eventsRecorded(ip);
  const store = getStore();
  const rows = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const name = String((e as Record<string, unknown>).event_name || '');
    if (!ALLOWED.has(name)) continue;
    const r = e as Record<string, unknown>;
    rows.push({
      user_id: me.id,
      event_name: name,
      properties: cleanProps(r.properties),
      session_id: typeof r.session_id === 'string' ? r.session_id.slice(0, 64) : null,
      client_version: typeof r.client_version === 'string' ? r.client_version.slice(0, 32) : null,
      platform: typeof r.platform === 'string' ? r.platform.slice(0, 32) : null
    });
  }
  const inserted = await store.insertEvents(rows);
  return json({ ok: true, inserted });
}
