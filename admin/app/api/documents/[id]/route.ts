import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const me = await sessionUser(req);
  if (!me) {
    return json({ error: 'Authentication required.' }, 401);
  }
  const doc = await getStore().getUserDocument(me.id, params.id);
  if (!doc) {
    return json({ error: 'Document not found.' }, 404);
  }
  return json({ ok: true, document: doc });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const me = await sessionUser(req);
  if (!me) {
    return json({ error: 'Authentication required.' }, 401);
  }
  const deleted = await getStore().deleteUserDocument(me.id, params.id);
  return json({ ok: true, deleted });
}
