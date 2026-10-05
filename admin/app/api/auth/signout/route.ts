import { getStore } from '@/lib/store';
import { json, tokenFromRequest, clearSessionCookieHeader } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = await tokenFromRequest(req);
  if (token) {
    try {
      await getStore().deleteSession(token);
    } catch { /* ignore */ }
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookieHeader() });
}
