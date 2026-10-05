/**
 * TokenTrim - BoilerplateRemover
 * Exact-repeat + page-number-variant header/footer removal.
 * Deliberately does NOT normalize arbitrary digits: body sentences that
 * differ only by numbers ("page 5 … 1005" vs "page 6 … 1006") must survive.
 * Keeps single-occurrence headings (e.g. ALL-CAPS resume sections).
 */

/** Variant key for running titles with page numbers, else null. */
function pageNumberVariant(line) {
  const t = String(line || '').trim();
  if (!/page\s*\d+|\b\d+\s*\/\s*\d+|^\d{1,4}$/i.test(t)) return null;
  return t.toLowerCase().replace(/page\s*\d+(\s*(of|\/)\s*\d+)?/gi, 'page #').replace(/\s+/g, ' ').trim();
}

export function detectRepeatedLines(pageTexts, aggressiveness = 'standard') {
  const repeated = new Set();
  if (!pageTexts || pageTexts.length < 2) return repeated;
  const exact = new Map();
  const variantPages = new Map();
  const variantEdge = new Map();
  pageTexts.forEach((pt, pi) => {
    const lines = String(pt || '').split('\n').map(l => l.trim()).filter(Boolean);
    const seenExact = new Set();
    const seenVar = new Set();
    lines.forEach((line, idx) => {
      if (!line || line.length > 140) return;
      if (!seenExact.has(line)) {
        seenExact.add(line);
        exact.set(line, (exact.get(line) || 0) + 1);
      }
      const v = pageNumberVariant(line);
      if (v && !seenVar.has(v)) {
        seenVar.add(v);
        if (!variantPages.has(v)) variantPages.set(v, new Set());
        variantPages.get(v).add(pi);
        if (idx < 2 || idx >= lines.length - 2) variantEdge.set(v, true);
      }
    });
  });
  const threshold = aggressiveness === 'aggressive'
    ? Math.max(2, Math.ceil(pageTexts.length / 3))
    : Math.max(2, Math.ceil(pageTexts.length / 2));
  for (const [line, n] of exact) {
    if (n >= threshold && line.length < 120) repeated.add(line);
  }
  for (const [v, pages] of variantPages) {
    if (pages.size >= threshold && variantEdge.get(v)) repeated.add('variant:' + v);
  }
  return repeated;
}

const BOILERPLATE_PATTERNS = [
  /^page\s+(#|n)(\s+of\s+(#|n))?$/i,
  /^#$/,
  /^©\s*#/,
  /confidential/i,
  /proprietary/i,
  /all rights reserved/i,
  /do not (copy|distribute|disclose)/i,
  /^\s*draft(\s*(-|—).*)?$/i
];

export function stripBoilerplate(text, pageTexts = [], options = {}) {
  const { aggressiveness = 'standard' } = options;
  const repeated = detectRepeatedLines(pageTexts, aggressiveness);
  const lines = String(text || '').split('\n');
  const out = [];
  let removed = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { out.push(''); continue; }
    let skip = false;
    if (repeated.has(trimmed)) skip = true;
    else {
      const v = pageNumberVariant(trimmed);
      if (v && repeated.has('variant:' + v)) skip = true;
    }
    if (!skip) {
      for (const rx of BOILERPLATE_PATTERNS) {
        if (rx.test(trimmed)) { skip = true; break; }
      }
    }
    if (!skip && trimmed.length <= 3 && /^\d+$/.test(trimmed)) skip = true;
    if (skip) removed++;
    else out.push(line);
  }
  return { text: out.join('\n'), removedLines: removed, repeatedCount: repeated.size };
}

export default { stripBoilerplate, detectRepeatedLines };
