import { getStore } from '@/lib/store';
import { json, sessionUser, requestMeta } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await sessionUser(req);
  if (!me || !me.is_admin) return json({ error: 'Admin access required.' }, 403);
  const { id } = await ctx.params;

  const store = getStore();
  const target = await store.findUserById(id);
  if (!target) return json({ error: 'User not found.' }, 404);

  const revoked = await store.revokeUserSessions(id, 'admin_revoke');
  const meta = requestMeta(req);
  try {
    await store.appendAuditLog({
      admin_id: me.id,
      action: 'revoke_sessions',
      target_user_id: id,
      details: { revoked },
      ip: meta.ip,
      user_agent: meta.userAgent
    });
    await store.insertEvents([{
      user_id: id,
      event_name: 'security_session_revoked',
      properties: { reason: 'admin_revoke', revoked } as Record<string, unknown>,
      session_id: null, client_version: null, platform: 'admin'
    }]);
  } catch { /* ignore */ }
  return json({ ok: true, revoked });
}
