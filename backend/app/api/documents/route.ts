import { getStore } from '@/lib/store';
import { json, sessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Max markdown payload size: 2 MB. */
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
/** Max chunks: 500 (each capped at 8 KB). */
const MAX_CHUNKS = 500;
const MAX_CHUNK_BYTES = 8 * 1024;

export async function GET(req: Request) {
  const me = await sessionUser(req);
  if (!me) {
    return json({ error: 'Authentication required.' }, 401);
  }
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const docs = await getStore().listUserDocuments(me.id, limit);
  return json({ ok: true, documents: docs });
}

export async function POST(req: Request) {
  const me = await sessionUser(req);
  if (!me) {
    return json({ error: 'Authentication required.' }, 401);
  }

  // ── Request body size guard ────────────────────────────────────────
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_MARKDOWN_BYTES + 512 * 1024) {
    return json({ error: 'Request body too large (max ~2.5 MB).' }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const title = String(body.title || '').trim();
  if (!title) {
    return json({ error: 'Document title is required.' }, 400);
  }
  if (title.length > 200) {
    return json({ error: 'Document title must be under 200 characters.' }, 400);
  }

  const markdown = typeof body.markdown === 'string' ? body.markdown : '';
  if (new Blob([markdown]).size > MAX_MARKDOWN_BYTES) {
    return json({ error: 'Markdown content too large (max 2 MB).' }, 413);
  }

  const preset = typeof body.preset === 'string' ? body.preset.slice(0, 32) : 'claude';
  const rawChunks = Array.isArray(body.chunks) ? (body.chunks as string[]) : [];
  const chunks = rawChunks.slice(0, MAX_CHUNKS).map((c) =>
    typeof c === 'string' ? c.slice(0, MAX_CHUNK_BYTES) : ''
  );
  const pages = typeof body.pages === 'number' ? Math.max(0, Math.min(10000, Math.round(body.pages))) : 0;
  const tokens = typeof body.tokens === 'number' ? Math.max(0, Math.min(10_000_000, Math.round(body.tokens))) : 0;
  const id = typeof body.id === 'string' && body.id ? body.id.slice(0, 64) : undefined;
  const source_type = typeof body.source_type === 'string' ? body.source_type.slice(0, 16) : 'pdf';
  const ocr_used = body.ocr_used === true;

  const docId = await getStore().saveUserDocument(me.id, {
    id,
    title,
    preset,
    markdown,
    chunks,
    pages,
    tokens,
    source_type,
    ocr_used
  });

  return json({ ok: true, id: docId });
}
