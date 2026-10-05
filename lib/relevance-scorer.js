/**
 * TokenTrim - RelevanceScorer (local BM25, no network)
 * Query-aware section selection: split markdown into sections, score vs query.
 */

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

export function splitSections(markdown) {
  const lines = String(markdown || '').split('\n');
  const sections = [];
  let cur = { heading: '(intro)', level: 0, lines: [] };
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      if (cur.lines.join('\n').trim()) sections.push({ ...cur, text: cur.lines.join('\n').trim() });
      cur = { heading: m[2].trim(), level: m[1].length, lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.lines.join('\n').trim()) sections.push({ ...cur, text: cur.lines.join('\n').trim() });
  if (!sections.length && String(markdown || '').trim()) {
    sections.push({ heading: '(document)', level: 0, lines: [markdown], text: markdown });
  }
  return sections;
}

export function bm25Select(markdown, query, options = {}) {
  const { topK = 5, maxChars = 12000 } = options;
  if (!query || !query.trim()) return { sections: [], text: markdown };
  const sections = splitSections(markdown);
  const qTerms = tokenize(query);
  if (!qTerms.length) return { sections: [], text: markdown };
  const N = sections.length;
  const df = {};
  const secTerms = sections.map(sec => {
    const toks = tokenize(sec.heading + ' ' + sec.text);
    const uniq = new Set(toks);
    for (const t of uniq) df[t] = (df[t] || 0) + 1;
    return toks;
  });
  const k1 = 1.2, b = 0.75;
  const avgLen = secTerms.reduce((a, t) => a + t.length, 0) / Math.max(1, secTerms.length);
  const scored = sections.map((sec, i) => {
    const toks = secTerms[i];
    const tf = {};
    for (const t of toks) tf[t] = (tf[t] || 0) + 1;
    let score = 0;
    for (const q of qTerms) {
      const f = tf[q] || 0;
      if (!f) continue;
      const n = df[q] || 1;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (toks.length / Math.max(1, avgLen)))));
    }
    // Heading match bonus
    if (tokenize(sec.heading).some(t => qTerms.includes(t))) score += 2;
    return { ...sec, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.filter(s => s.score > 0).slice(0, Math.max(1, topK));
  // No section matched: signal noMatch so callers keep the full document
  // instead of silently returning an arbitrary first section.
  if (!picked.length) return { sections: [], text: markdown, noMatch: true };
  const finalPick = picked;
  let text = '';
  const used = [];
  for (const s of finalPick) {
    const block = `## ${s.heading}\n\n${s.text}`;
    if ((text + '\n\n' + block).length > maxChars) break;
    text += (text ? '\n\n' : '') + block;
    used.push({ heading: s.heading, score: Math.round(s.score * 100) / 100 });
  }
  return { sections: used, text: text || markdown };
}

export default { splitSections, bm25Select };
