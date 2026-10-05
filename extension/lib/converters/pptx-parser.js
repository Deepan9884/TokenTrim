/**
 * TokenTrim - PPTX → Markdown parser (dependency-free, local).
 * Reads presentation.xml for slide order, then each slide XML for
 * shapes/text/tables, plus notesSlides for speaker notes.
 * Output: `## Slide N — <title>` + bullets + tables + notes as quotes.
 */

import { unzipFiles } from './ooxml-zip.js';

function parseXml(text) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(text, 'application/xml');
  }
  return null;
}

function textsOf(doc, tagSuffix) {
  if (!doc || !doc.getElementsByTagName) return [];
  // Namespace-agnostic: match any tag ending with suffix (e.g. 't')
  const all = doc.getElementsByTagName('*');
  const out = [];
  for (const el of all) {
    const name = el.tagName || el.nodeName || '';
    if (name === tagSuffix || name.endsWith(':' + tagSuffix)) {
      out.push(el.textContent || '');
    }
  }
  return out;
}

function isInsideTable(node) {
  let cur = node.parentNode;
  while (cur) {
    const name = cur.tagName || cur.nodeName || '';
    const s = name.includes(':') ? name.split(':').pop() : name;
    if (s === 'tbl' || s === 'tc') return true;
    cur = cur.parentNode;
  }
  return false;
}

function slideTexts(slideDoc) {
  // Paragraphs: group <a:p> elements → each becomes a line/bullet
  if (!slideDoc || !slideDoc.getElementsByTagName) return { lines: [], tables: [] };
  const all = slideDoc.getElementsByTagName('*');
  const lines = [];
  const tables = [];
  for (const el of all) {
    const name = (el.tagName || el.nodeName || '');
    const short = name.includes(':') ? name.split(':').pop() : name;
    if (short === 'p' && !isInsideTable(el)) {
      // collect <a:t> children of this paragraph
      const ts = [];
      const kids = el.getElementsByTagName('*');
      for (const k of kids) {
        const kn = (k.tagName || k.nodeName || '');
        const ks = kn.includes(':') ? kn.split(':').pop() : kn;
        if (ks === 't') ts.push(k.textContent || '');
      }
      const line = ts.join('').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
    if (short === 'tbl') {
      // table: rows <a:tr> → cells <a:tc> → text
      const rows = [];
      const trs = el.getElementsByTagName('*');
      // simpler: iterate direct structure via query
      const rowEls = [...el.childNodes].flatMap(() => []);
      void rowEls; void trs;
      const grid = [];
      const allTr = [];
      const walk = (node) => {
        if (!node || !node.childNodes) return;
        const n = (node.tagName || node.nodeName || '');
        const s = n.includes(':') ? n.split(':').pop() : n;
        if (s === 'tr') allTr.push(node);
        for (const c of node.childNodes) walk(c);
      };
      walk(el);
      for (const tr of allTr) {
        const cells = [];
        const walkTc = (node) => {
          if (!node || !node.childNodes) return;
          const n = (node.tagName || node.nodeName || '');
          const s = n.includes(':') ? n.split(':').pop() : n;
          if (s === 'tc') {
            const tEls = node.getElementsByTagName('*');
            let txt = '';
            for (const t of tEls) {
              const tn = (t.tagName || t.nodeName || '');
              const ts2 = tn.includes(':') ? tn.split(':').pop() : tn;
              if (ts2 === 't') txt += (t.textContent || '');
            }
            cells.push(txt.replace(/\s+/g, ' ').trim());
          } else {
            for (const c of node.childNodes) walkTc(c);
          }
        };
        for (const c of tr.childNodes) walkTc(c);
        // walkTc double-counts; dedupe by direct tcs:
        void cells; void rows;
        const directCells = [];
        for (const c of tr.childNodes) {
          const n = (c.tagName || c.nodeName || '');
          const s = n.includes(':') ? n.split(':').pop() : n;
          if (s === 'tc') {
            const inner = [];
            const tEls = c.getElementsByTagName('*');
            for (const t of tEls) {
              const tn = (t.tagName || t.nodeName || '');
              const ts3 = tn.includes(':') ? tn.split(':').pop() : tn;
              if (ts3 === 't') inner.push(t.textContent || '');
            }
            directCells.push(inner.join('').replace(/\s+/g, ' ').trim());
          }
        }
        if (directCells.length) grid.push(directCells);
      }
      if (grid.length) tables.push(grid);
    }
  }
  return { lines, tables };
}

function toMarkdownTable(grid) {
  if (!grid.length) return '';
  const cols = Math.max(...grid.map((r) => r.length));
  const norm = grid.map((r) => {
    const c = [...r];
    while (c.length < cols) c.push('');
    return c.map((x) => String(x).replace(/\|/g, '\\|').trim());
  });
  let md = '\n| ' + norm[0].join(' | ') + ' |\n';
  md += '| ' + norm[0].map(() => '---').join(' | ') + ' |\n';
  for (const r of norm.slice(1)) md += '| ' + r.join(' | ') + ' |\n';
  return md;
}

function slideOrderFromPresentation(presXml) {
  const doc = parseXml(presXml);
  if (!doc) return [];
  const all = doc.getElementsByTagName('*');
  const order = [];
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'sldId') {
      const rId = el.getAttribute('r:id') || el.getAttribute('id') || '';
      if (rId) order.push(rId);
    }
  }
  return order;
}

function relsMap(relsXml) {
  const doc = parseXml(relsXml);
  const map = new Map();
  if (!doc) return map;
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'Relationship') {
      const id = el.getAttribute('Id') || '';
      const target = el.getAttribute('Target') || '';
      if (id && target) map.set(id, target);
    }
  }
  return map;
}

export async function parsePptxToMarkdown(arrayBuffer, opts = {}) {
  const { includeNotes = true, includeHidden = true } = opts;
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  if (bytes.length >= 4 && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    throw new Error('LEGACY_FORMAT');
  }
  const zip = await unzipFiles(arrayBuffer);
  const names = zip.names();

  const presXml = await zip.readText('ppt/presentation.xml').catch(() => null);
  if (!presXml) throw new Error('CORRUPT_FILE');
  const order = slideOrderFromPresentation(presXml);
  const presRels = await zip.readText('ppt/_rels/presentation.xml.rels').catch(() => null);
  const relMap = presRels ? relsMap(presRels) : new Map();

  // Resolve slide paths in order; fallback to lexical slide list
  let slidePaths = order
    .map((id) => relMap.get(id))
    .filter(Boolean)
    .map((t) => (t.startsWith('ppt/') ? t : 'ppt/' + t.replace(/^\//, '')));
  if (!slidePaths.length) {
    slidePaths = names
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = parseInt((a.match(/slide(\d+)/) || [])[1] || '0', 10);
        const nb = parseInt((b.match(/slide(\d+)/) || [])[1] || '0', 10);
        return na - nb;
      });
  }
  if (!slidePaths.length) throw new Error('EMPTY_FILE');

  // Notes map: slideN → notesSlideN (best effort)
  const notePaths = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).sort();

  const slides = [];
  let idx = 0;
  for (const sp of slidePaths) {
    idx++;
    let xml = null;
    try { xml = await zip.readText(sp); } catch { continue; }
    const doc = parseXml(xml);
    const { lines, tables } = slideTexts(doc);
    // Hidden? <p:show> / show="0" — best effort, keep unless excluded
    const isHidden = /show="0"/.test(xml);
    if (isHidden && !includeHidden) continue;

    // Notes for this index
    let notes = [];
    if (includeNotes && notePaths[idx - 1]) {
      try {
        const nxml = await zip.readText(notePaths[idx - 1]);
        const ndoc = parseXml(nxml);
        const { lines: nlines } = slideTexts(ndoc);
        // Notes slides repeat slide text; keep lines that look like notes (longer)
        notes = nlines.filter((l) => l.length > 2);
      } catch { /* ignore */ }
    }

    slides.push({ n: idx, lines, tables, notes });
  }

  if (!slides.length) throw new Error('EMPTY_FILE');

  // Assemble markdown
  let md = '';
  for (const s of slides) {
    const title = s.lines[0] || `Slide ${s.n}`;
    const rest = s.lines.slice(1);
    md += `## Slide ${s.n} — ${title}\n\n`;
    for (const ln of rest) {
      md += `- ${ln}\n`;
    }
    if (rest.length) md += '\n';
    for (const t of s.tables) md += toMarkdownTable(t) + '\n';
    if (s.notes && s.notes.length) {
      // Avoid echoing slide bullets as notes: drop notes identical to slide lines
      const slideSet = new Set(s.lines.map((l) => l.toLowerCase()));
      const uniq = s.notes.filter((l) => !slideSet.has(l.toLowerCase()));
      if (uniq.length) {
        md += '> **Speaker notes:**\n';
        for (const n of uniq.slice(0, 20)) md += `> ${n}\n`;
        md += '\n';
      }
    }
    md += '\n';
  }

  const rawText = slides.map((s) => s.lines.join('\n')).join('\n\n');
  void textsOf;
  return { markdown: md.trim() + '\n', slides: slides.length, rawText };
}

export default { parsePptxToMarkdown };
