/**
 * TokenTrim - Spreadsheet → Markdown (XLSX dependency-free + CSV/TSV).
 * XLSX: parse sharedStrings + sheet XML (inline + shared + numbers),
 * emit one ## Sheet per worksheet with a Markdown table (capped).
 * CSV/TSV: delimiter-sniff, quote-aware split, first row = header.
 */

import { unzipFiles } from './ooxml-zip.js';

const MAX_ROWS_PER_SHEET = 500;
const MAX_COLS = 26;
const MAX_CELL = 300;

function colToIndex(col) {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSharedStrings(xml) {
  if (!xml || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'si') {
      const ts = [];
      const kids = el.getElementsByTagName('*');
      for (const k of kids) {
        const kn = (k.tagName || k.nodeName || '');
        const ks = kn.includes(':') ? kn.split(':').pop() : kn;
        if (ks === 't') ts.push(k.textContent || '');
      }
      out.push(ts.join(''));
    }
  }
  return out;
}

function parseSheet(xml, shared) {
  if (!xml || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rows = new Map(); // rowIdx -> Map(colIdx -> val)
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s !== 'c') continue;
    const ref = el.getAttribute('r') || '';
    const m = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!m) continue;
    const ci = colToIndex(m[1]);
    const ri = parseInt(m[2], 10) - 1;
    if (ci > MAX_COLS - 1) continue;
    const t = el.getAttribute('t') || '';
    let val = '';
    // children: <v> or <is><t>
    const kids = el.childNodes || [];
    for (const k of kids) {
      const kn = (k.tagName || k.nodeName || '');
      const ks = kn.includes(':') ? kn.split(':').pop() : kn;
      if (ks === 'v') {
        const raw = (k.textContent || '').trim();
        if (t === 's') {
          const si = parseInt(raw, 10);
          val = Number.isFinite(si) && shared[si] !== undefined ? shared[si] : raw;
        } else if (t === 'b') {
          val = raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : raw;
        } else if (t === 'e' || t === 'str') {
          val = raw;
        } else {
          val = raw;
        }
      } else if (ks === 'is') {
        const ts = [];
        const inner = k.getElementsByTagName ? k.getElementsByTagName('*') : [];
        for (const q of inner) {
          const qn = (q.tagName || q.nodeName || '');
          const qs = qn.includes(':') ? qn.split(':').pop() : qn;
          if (qs === 't') ts.push(q.textContent || '');
        }
        val = ts.join('');
      }
    }
    if (!rows.has(ri)) rows.set(ri, new Map());
    rows.get(ri).set(ci, String(val).slice(0, MAX_CELL));
  }
  const idxs = [...rows.keys()].sort((a, b) => a - b).slice(0, MAX_ROWS_PER_SHEET);
  const grid = idxs.map((ri) => {
    const mrow = rows.get(ri);
    const width = Math.min(MAX_COLS, Math.max(1, ...[...mrow.keys()].map((c) => c + 1)));
    const r = [];
    for (let c = 0; c < width; c++) r.push((mrow.get(c) ?? '').replace(/\s+/g, ' ').trim());
    return r;
  });
  // Drop fully-empty trailing rows
  while (grid.length && grid[grid.length - 1].every((c) => !c)) grid.pop();
  return grid;
}

function sheetNames(workbookXml) {
  if (!workbookXml || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(workbookXml, 'application/xml');
  const out = [];
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'sheet') {
      const name = el.getAttribute('name') || `Sheet${out.length + 1}`;
      const sid = el.getAttribute('r:id') || el.getAttribute('id') || '';
      out.push({ name, sid });
    }
  }
  return out;
}

function wbRels(relsXml) {
  if (!relsXml || typeof DOMParser === 'undefined') return new Map();
  const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
  const map = new Map();
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'Relationship') map.set(el.getAttribute('Id') || '', el.getAttribute('Target') || '');
  }
  return map;
}

export async function parseXlsxToMarkdown(arrayBuffer) {
  const zip = await unzipFiles(arrayBuffer);
  const sharedXml = await zip.readText('xl/sharedStrings.xml').catch(() => null);
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const wbXml = await zip.readText('xl/workbook.xml').catch(() => null);
  if (!wbXml) throw new Error('CORRUPT_FILE');
  const sheets = sheetNames(wbXml);
  const relsXml = await zip.readText('xl/_rels/workbook.xml.rels').catch(() => null);
  const relMap = wbRels(relsXml);

  let paths = sheets.map((s, i) => {
    const t = relMap.get(s.sid) || `worksheets/sheet${i + 1}.xml`;
    return { name: s.name, path: t.startsWith('xl/') ? t : 'xl/' + t.replace(/^\//, '') };
  });
  if (!paths.length) {
    paths = zip.names()
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort()
      .map((p, i) => ({ name: `Sheet${i + 1}`, path: p }));
  }
  if (!paths.length) throw new Error('EMPTY_FILE');

  let md = '';
  let totalRows = 0;
  for (const { name, path } of paths.slice(0, 20)) {
    let xml = null;
    try { xml = await zip.readText(path); } catch { continue; }
    const grid = parseSheet(xml, shared);
    if (!grid.length || !grid.some((r) => r.some((c) => c))) continue;
    totalRows += grid.length;
    md += `## ${name}\n\n`;
    const cols = Math.max(...grid.map((r) => r.length));
    const norm = grid.map((r) => {
      const c = [...r];
      while (c.length < cols) c.push('');
      return c.map((x) => String(x).replace(/\|/g, '\\|'));
    });
    md += '| ' + norm[0].join(' | ') + ' |\n';
    md += '| ' + norm[0].map(() => '---').join(' | ') + ' |\n';
    for (const r of norm.slice(1)) md += '| ' + r.join(' | ') + ' |\n';
    md += '\n';
  }
  if (!md.trim()) throw new Error('EMPTY_FILE');
  return { markdown: md.trim() + '\n', sheets: paths.length, rows: totalRows, rawText: md };
}

// ---- CSV / TSV ----

function sniffDelimiter(sample) {
  const lines = sample.split('\n').slice(0, 5).join('\n');
  const counts = {
    ',': (lines.match(/,/g) || []).length,
    ';': (lines.match(/;/g) || []).length,
    '\t': (lines.match(/\t/g) || []).length,
    '|': (lines.match(/\|/g) || []).length
  };
  let best = ',';
  let bestN = -1;
  for (const [d, n] of Object.entries(counts)) if (n > bestN) { bestN = n; best = d; }
  return best;
}

export function parseDelimitedToMarkdown(text, filename = '') {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  if (!raw.trim()) throw new Error('EMPTY_FILE');
  const delim = filename.toLowerCase().endsWith('.tsv') ? '\t' : sniffDelimiter(raw);
  const rows = [];
  let cur = [''];
  let inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQ) {
      if (ch === '"') {
        if (raw[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
        else inQ = false;
      } else cur[cur.length - 1] += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) cur.push('');
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { rows.push(cur); cur = ['']; if (rows.length > MAX_ROWS_PER_SHEET) break; }
      else cur[cur.length - 1] += ch;
    }
  }
  if (cur.some((c) => c.trim())) rows.push(cur);
  const grid = rows.map((r) => r.map((c) => c.trim().slice(0, MAX_CELL)));
  while (grid.length && grid[grid.length - 1].every((c) => !c)) grid.pop();
  if (!grid.length) throw new Error('EMPTY_FILE');
  const cols = Math.max(...grid.map((r) => r.length));
  const norm = grid.map((r) => {
    const c = [...r];
    while (c.length < cols) c.push('');
    return c.map((x) => String(x).replace(/\|/g, '\\|'));
  });
  let md = '| ' + norm[0].join(' | ') + ' |\n';
  md += '| ' + norm[0].map(() => '---').join(' | ') + ' |\n';
  for (const r of norm.slice(1)) md += '| ' + r.join(' | ') + ' |\n';
  return { markdown: md + '\n', rows: norm.length, rawText: raw.slice(0, 200000) };
}

export default { parseXlsxToMarkdown, parseDelimitedToMarkdown };
