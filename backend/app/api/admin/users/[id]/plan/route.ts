import { getStore } from '@/lib/store';
import { json, sessionUser, requestMeta } from '@/lib/session';
import { validatePlanExpiresAt } from '@/lib/validation';
import { verifyActionToken, consumeActionToken, type ActionTokenPayload } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * Change a user's plan.
 * - Downgrade to free: admin session is enough; clears any Pro expiration.
 * - Grant / edit Pro (plan === 'pro'): requires a fresh step-up token from
 *   POST /api/admin/reauth sent as the `X-Admin-Action` header.
 * Body: { plan: 'free' | 'pro', expires_at?: string | null }
 *   expires_at omitted/null = perpetual Pro. Max 3 years out.
 */
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
  const plan = String(body.plan || '').toLowerCase();
  if (!['free', 'pro'].includes(plan)) return json({ error: 'Plan must be free or pro.' }, 400);

  const store = getStore();
  const target = await store.findUserById(id);
  if (!target) return json({ error: 'User not found.' }, 404);
  if (target.is_admin) return json({ error: 'Admin plans cannot be changed here.' }, 400);

  let expiresAt: string | null = null;
  let reauthed = false;
  let actionPayload: ActionTokenPayload | null = null;

  if (plan === 'pro') {
    // Step-up gate: granting or editing Pro needs password + PIN proof.
    // The token is consumed only after the grant succeeds, so a validation
    // error (e.g. bad date) does not burn the admin's re-auth.
    const token = (req.headers.get('x-admin-action') || '').trim();
    actionPayload = token ? verifyActionToken(token, me.id, 'grant_pro') : null;
    if (!actionPayload) {
      return json({ error: 'Re-enter your password and 4-digit key to grant Pro.' }, 403);
    }
    reauthed = true;

    if (body.expires_at !== undefined) {
      const v = validatePlanExpiresAt(body.expires_at);
      if (v.error) return json({ error: v.error }, 400);
      expiresAt = v.iso ?? null;
    } else {
      // No expiry supplied: keep an existing future expiry, else perpetual.
      const cur = target.plan_expires_at || null;
      expiresAt = cur && Date.parse(cur) > Date.now() ? cur : null;
    }
  }

  const from = target.plan;
  const fromExpiry = target.plan_expires_at || null;
  try {
    await store.setUserPlan(id, plan, expiresAt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not save the plan.';
    const code = (e as NodeJS.ErrnoException)?.code;
    return json({ error: msg }, code === 'EXPIRY_UNSUPPORTED' ? 409 : 500);
  }
  if (actionPayload) consumeActionToken(actionPayload);

  const meta = requestMeta(req);
  try {
    await store.appendAuditLog({
      admin_id: me.id, action: 'change_plan', target_user_id: id,
      details: { from, to: plan, from_expires_at: fromExpiry, expires_at: expiresAt, admin_reauth: reauthed },
      ip: meta.ip, user_agent: meta.userAgent
    });
  } catch { /* ignore */ }
  return json({ ok: true, plan, expires_at: expiresAt });
}
