/**
 * TokenTrim - TableOptimizer
 * Cleans markdown tables: empty columns, repeated headers, whitespace,
 * unit normalization, source refs. Supports markdown / compact / csv styles.
 */

function splitRow(line) {
  const t = String(line || '').trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t.slice(1, -1).split('|').map(c => c.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c));
}

function normalizeCell(c) {
  return String(c || '').replace(/\s+/g, ' ').trim();
}

const SEP = '';

export function optimizeTableBlock(lines, options = {}) {
  const { style = 'markdown', sourceRef = null } = options;
  const rows = [];
  for (const line of lines) {
    const cells = splitRow(line);
    if (!cells) continue;
    rows.push(cells.map(normalizeCell));
  }
  if (rows.length < 2) return { text: lines.join('\n'), stats: { tables: 0 } };
  const data = rows.filter(r => !isSeparatorRow(r));
  if (data.length < 1) return { text: lines.join('\n'), stats: { tables: 0 } };
  const maxCols = Math.max(...data.map(r => r.length));
  const norm = data.map(r => {
    const c = [...r];
    while (c.length < maxCols) c.push('');
    return c;
  });
  // 1) Drop repeated header rows FIRST so they can't keep empty columns alive
  const hkey = norm[0].join(SEP).toLowerCase();
  const deduped = [norm[0], ...norm.slice(1).filter(r => r.join(SEP).toLowerCase() !== hkey)];
  const repeatedDropped = norm.length - deduped.length;
  // 2) Drop columns whose body cells are all empty (header label alone doesn't keep it)
  const keepCols = [];
  const bodyRows = deduped.slice(1);
  for (let c = 0; c < maxCols; c++) {
    const hasContent = bodyRows.some(r => r[c] && !/^-+$/.test(r[c]));
    if (hasContent) keepCols.push(c);
  }
  if (keepCols.length === 0) deduped[0].forEach((_, c) => keepCols.push(c));
  const kept = deduped.map(r => keepCols.map(c => r[c]));
  const header = kept[0];
  const body = kept.slice(1);
  let text;
  if (style === 'csv') {
    const esc = (v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    text = [header, ...body].map(r => r.map(esc).join(',')).join('\n');
  } else if (style === 'compact') {
    text = [header, ...body].map(r => '| ' + r.join(' | ') + ' |').join('\n');
  } else {
    const sep = header.map(() => '---');
    text = '| ' + header.join(' | ') + ' |\n| ' + sep.join(' | ') + ' |\n'
      + body.map(r => '| ' + r.join(' | ') + ' |').join('\n');
  }
  if (sourceRef) text += `\n<!-- table source: ${sourceRef} -->`;
  return {
    text,
    stats: {
      tables: 1,
      columnsDropped: maxCols - keepCols.length,
      rowsDropped: repeatedDropped,
      rows: kept.length
    }
  };
}

/**
 * Detect plain-text columnar runs (tabs or 3+ spaces) and convert them
 * to Markdown tables. This is the PDF path: pdf.js yields positioned text,
 * not table structure. DOCX tables arrive via Mammoth as real tables.
 */
export function detectTextTables(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let buf = [];
  // Guards against prose false-positives: consistent column count, short
  // cells (table cells, not sentences), at least 2 consecutive rows.
  const looksTabular = (rows) => {
    if (rows.length < 2) return false;
    const n = rows[0].length;
    if (n < 2) return false;
    return rows.every(r => r.length === n && r.every(c => c.length > 0 && c.length <= 30));
  };
  const flush = () => {
    if (looksTabular(buf)) {
      const header = buf[0];
      const sep = header.map(() => '---');
      out.push('| ' + header.join(' | ') + ' |');
      out.push('| ' + sep.join(' | ') + ' |');
      for (const row of buf.slice(1)) out.push('| ' + row.join(' | ') + ' |');
    } else if (buf.length === 1) {
      out.push(buf[0].join(' '));
    } else if (buf.length > 1) {
      // Inconsistent columns: restore lines joined singly, no table.
      for (const r of buf) out.push(r.join(' '));
    }
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\s*\|.*\|\s*$/.test(raw)) { flush(); out.push(raw); continue; }
    // PDF extractor emits 1–2 space runs for column gaps (never tabs),
    // so split on 2+ spaces; guards above reject prose.
    const cols = line.split(/\t+|\s{2,}/).map(c => c.trim()).filter(c => c);
    if (cols.length >= 2 && line.length > 0) buf.push(cols);
    else { flush(); out.push(raw); }
  }
  flush();
  return out.join('\n');
}

export function optimizeMarkdownTables(markdown, options = {}) {
  const lines = String(markdown || '').split('\n');
  const out = [];
  let buf = [];
  const totals = { tables: 0, columnsDropped: 0, rowsDropped: 0 };
  const flush = (sourceRef) => {
    if (buf.length >= 2) {
      const r = optimizeTableBlock(buf, { ...options, sourceRef });
      out.push(r.text);
      totals.tables += r.stats.tables;
      totals.columnsDropped += r.stats.columnsDropped || 0;
      totals.rowsDropped += r.stats.rowsDropped || 0;
    } else {
      out.push(...buf);
    }
    buf = [];
  };
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) buf.push(line);
    else {
      if (buf.length) flush(options.sourceRef);
      out.push(line);
    }
  }
  if (buf.length) flush(options.sourceRef);
  return { text: out.join('\n'), stats: totals };
}

export default { optimizeTableBlock, optimizeMarkdownTables, detectTextTables };
