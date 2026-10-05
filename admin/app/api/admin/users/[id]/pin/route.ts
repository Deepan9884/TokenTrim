import { getStore } from '@/lib/store';
import { json, sessionUser, requestMeta } from '@/lib/session';
import { validatePin } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const pin = String(body.pin || '').trim();
  const err = validatePin(pin);
  if (err) return json({ error: err }, 400);

  const store = getStore();
  const target = await store.findUserById(id);
  if (!target) return json({ error: 'User not found.' }, 404);
  await store.resetUserPin(id, pin);
  const meta = requestMeta(req);
  try {
    await store.appendAuditLog({
      admin_id: me.id, action: 'reset_pin', target_user_id: id,
      details: {}, ip: meta.ip, user_agent: meta.userAgent
    });
    await store.insertEvents([{
      user_id: id, event_name: 'security_admin_action',
      properties: { action: 'reset_pin' } as Record<string, unknown>,
      session_id: null, client_version: null, platform: 'admin'
    }]);
  } catch { /* ignore */ }
  return json({ ok: true });
}
