import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) return json({ user: null }, 401, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  return json({ user }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
}
