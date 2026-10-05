import { getStore } from '@/lib/store';
import { json } from '@/lib/session';
import { validateEmail, normalizeEmail } from '@/lib/validation';
import { pinAllowed } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Step 1 of recovery (no email is sent, per requirements).
 * Always returns ok so callers can't probe which emails exist.
 * The client then asks for the 4-digit key chosen at signup.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const email = normalizeEmail(body.email);
  if (validateEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const gate = pinAllowed(`forgot:${email}`);
  if (!gate.ok) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minutes.` }, 429);
  }
  // Touch the store so timing is uniform; result is intentionally ignored.
  try {
    await getStore().findUserByEmail(email);
  } catch { /* ignore */ }
  return json({ ok: true });
}
