/**
 * TokenTrim - PageRange parser + selector
 * Custom extraction input like "1-20, 29-31", "5", "1-5, 8, 11-13".
 * Pure, tested, no DOM. Pages are 1-indexed.
 */

/** Normalize dashes (hyphen, en-dash, em-dash, "to") to "-". */
function normalizeDashes(s) {
  return String(s || '')
    .replace(/[–—]/g, '-')
    .replace(/\bto\b/gi, '-');
}

/**
 * Parse a range string WITHOUT knowing the total (popup-side validation).
 * Returns { pages: number[] } (sorted, deduped) or { error: string }.
 * Blank / "all" → { pages: null } meaning no filter.
 */
export function parsePageRange(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw || raw === 'all') return { pages: null };
  const parts = normalizeDashes(raw).split(',').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return { pages: null };

  const pages = new Set();
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) return { error: `Invalid page range: "${part}". Use like 1-5, 8, 11-13.` };
    const from = parseInt(m[1], 10);
    const to = m[2] !== undefined ? parseInt(m[2], 10) : from;
    if (from < 1 || to < 1) return { error: 'Page numbers start at 1.' };
    if (from > to) return { error: `Reversed range: "${part}". Write the smaller page first.` };
    if (to - from > 10000) return { error: `Range too large: "${part}".` };
    for (let p = from; p <= to; p++) pages.add(p);
  }
  if (!pages.size) return { pages: null };
  return { pages: [...pages].sort((a, b) => a - b) };
}

/**
 * Clamp a parsed page list to [1, totalPages].
 * Returns { pages } (valid subset) or { error } when nothing remains.
 */
export function clampPages(pages, totalPages) {
  const total = Math.max(1, Math.floor(totalPages || 0));
  const kept = (pages || []).filter(p => p >= 1 && p <= total);
  if (!kept.length) {
    return { error: `Pages out of range: this document has ${total} page${total === 1 ? '' : 's'}.` };
  }
  return { pages: kept };
}

/** Compact display: [1,2,3,5,7,8,9] → "1-3, 5, 7-9". */
export function formatPages(pages) {
  const list = [...(pages || [])].sort((a, b) => a - b);
  if (!list.length) return '';
  const out = [];
  let start = list[0], prev = list[0];
  for (let i = 1; i <= list.length; i++) {
    const cur = list[i];
    if (cur === prev + 1) { prev = cur; continue; }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur; prev = cur;
  }
  return out.join(', ');
}

export default { parsePageRange, clampPages, formatPages };
