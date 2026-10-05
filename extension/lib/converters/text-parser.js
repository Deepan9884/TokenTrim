/**
 * TokenTrim - Text-family → Markdown (TXT / MD / HTML / EPUB-lite).
 * TXT/MD: pass-through + light normalize.
 * HTML: readability-lite (strip nav/script/style, prefer <article>/<main>,
 * headings/paragraphs/lists/tables/pre) then reuse host Turndown when
 * available, else regex fallback.
 * EPUB: dependency-free unzip of OPF spine → ordered XHTML chapters.
 */

import { unzipFiles } from './ooxml-zip.js';

function normalizePlain(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

export function parseTextToMarkdown(text) {
  const clean = normalizePlain(text);
  if (!clean.trim()) throw new Error('EMPTY_FILE');
  return { markdown: clean, rawText: clean };
}

export function htmlToMarkdownSmart(html, formatTables = true) {
  const raw = String(html || '');
  if (!raw.trim()) throw new Error('EMPTY_FILE');
  let doc = null;
  try {
    if (typeof DOMParser !== 'undefined') {
      doc = new DOMParser().parseFromString(raw, 'text/html');
    }
  } catch { doc = null; }
  let pruned = raw;
  if (doc) {
    try {
      doc.querySelectorAll('script, style, noscript, template, svg, canvas, iframe').forEach((n) => n.remove());
      doc.querySelectorAll('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], .sidebar, .nav, .menu, .ad, .ads, .cookie, .newsletter').forEach((n) => n.remove());
      const main = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('[role="main"]');
      const scope = main || doc.body || doc.documentElement;
      pruned = scope ? scope.innerHTML : raw;
      // Drop empty leftovers
      if (!pruned || pruned.replace(/<[^>]+>/g, '').trim().length < 20) pruned = raw;
    } catch { pruned = raw; }
  }
  // Reuse host Turndown (already vendored) when present
  try {
    const TD = (typeof window !== 'undefined' && window.TurndownService)
      ? window.TurndownService
      : (typeof TurndownService !== 'undefined' ? TurndownService : null);
    if (TD) {
      const svc = new TD({ headingStyle: 'atx', hr: '---', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
      try {
        const gfm = (typeof window !== 'undefined' && window.turndownPluginGfm) ? window.turndownPluginGfm : null;
        if (gfm && gfm.gfm) svc.use(gfm.gfm);
      } catch { /* optional */ }
      const md = svc.turndown(pruned);
      if (md && md.trim().length >= 20) return { markdown: normalizePlain(md), rawText: md };
    }
  } catch { /* fall through */ }
  // Regex fallback
  let t = pruned
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n')
    .replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gis, '**$1**\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<(b)[^>]*>(.*?)<\/\1>/gis, '**$2**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<(i)[^>]*>(.*?)<\/\1>/gis, '*$2*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, '[$2]($1)')
    .replace(/<[^>]+>/g, '');
  // decode a few entities
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  void formatTables;
  const clean = normalizePlain(t);
  if (!clean.trim()) throw new Error('EMPTY_FILE');
  return { markdown: clean, rawText: clean };
}

function opfPaths(containerXml) {
  if (!containerXml || typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const all = doc.getElementsByTagName('*');
    const out = [];
    for (const el of all) {
      const n = (el.tagName || el.nodeName || '');
      const s = n.includes(':') ? n.split(':').pop() : n;
      if (s === 'rootfile') {
        const p = el.getAttribute('full-path');
        if (p) out.push(p);
      }
    }
    return out;
  } catch { return []; }
}

export async function parseEpubToMarkdown(arrayBuffer) {
  const zip = await unzipFiles(arrayBuffer);
  const container = await zip.readText('META-INF/container.xml').catch(() => null);
  if (!container) throw new Error('CORRUPT_FILE');
  const opfList = opfPaths(container);
  if (!opfList.length) throw new Error('CORRUPT_FILE');
  const opfPath = opfList[0];
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = await zip.readText(opfPath).catch(() => null);
  if (!opf || typeof DOMParser === 'undefined') throw new Error('CORRUPT_FILE');
  const doc = new DOMParser().parseFromString(opf, 'application/xml');
  const manifest = new Map();
  const spine = [];
  const all = doc.getElementsByTagName('*');
  for (const el of all) {
    const n = (el.tagName || el.nodeName || '');
    const s = n.includes(':') ? n.split(':').pop() : n;
    if (s === 'item') {
      const id = el.getAttribute('id');
      const href = el.getAttribute('href');
      if (id && href) manifest.set(id, decodeURIComponent(href));
    }
    if (s === 'itemref') {
      const idref = el.getAttribute('idref');
      if (idref) spine.push(idref);
    }
  }
  // Title / creator best effort
  let bookTitle = '';
  try {
    const t = doc.getElementsByTagName('dc:title');
    if (t && t[0]) bookTitle = (t[0].textContent || '').trim();
  } catch { /* ignore */ }

  let md = bookTitle ? `# ${bookTitle}\n\n` : '';
  let chapters = 0;
  for (const id of spine.slice(0, 100)) {
    const href = manifest.get(id);
    if (!href || !/\.(x?html?|xml)$/i.test(href)) continue;
    const full = base + href;
    let html = null;
    try { html = await zip.readText(full); } catch { continue; }
    if (!html) continue;
    try {
      const part = htmlToMarkdownSmart(html);
      if (part.markdown.trim().length > 20) {
        md += part.markdown + '\n';
        chapters++;
      }
    } catch { /* skip bad chapter */ }
  }
  if (!md.trim() || chapters === 0) throw new Error('EMPTY_FILE');
  return { markdown: normalizePlain(md), chapters, rawText: md.slice(0, 300000) };
}

export default { parseTextToMarkdown, htmlToMarkdownSmart, parseEpubToMarkdown };
