/**
 * TokenTrim - Side Panel (direct conversion, no notification round-trip)
 */
import { converter } from './lib/converter.js';
import { applyPresetToOptions } from './lib/presets.js';

let file = null;
let markdown = '';

const $ = (id) => document.getElementById(id);

function sanitizeDownloadFilename(name, fallback = 'document') {
  const base = String(name || fallback)
    .replace(/\.(pdf|docx|pptx?|png|jpe?g|webp|gif|bmp|tiff?|xlsx?|csv|tsv|txt|md|markdown|html?|epub)$/i, '')
    .replace(/[/\\:]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return (base || fallback) + '.md';
}

function isAllowedPendingUrl(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (!/\.(pdf|docx|pptx?|xlsx?|csv|tsv|txt|md|markdown|html?|epub)(\?|#|$)/i.test(u.pathname + u.search)) {
      if (!/\.pdf/i.test(String(url))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function pending() {
  try {
    const r = await chrome.storage.local.get(['pendingPdfUrl', 'pendingPdfName']);
    if (r.pendingPdfUrl) {
      if (!isAllowedPendingUrl(r.pendingPdfUrl)) throw new Error('Blocked untrusted pending URL.');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        const resp = await fetch(r.pendingPdfUrl, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const blob = await resp.blob();
        if (blob.size > 200 * 1024 * 1024) throw new Error('Pending file exceeds 200 MB.');
        file = new File([blob], r.pendingPdfName || 'document.pdf', { type: 'application/pdf' });
      } finally {
        clearTimeout(timer);
      }
      $('spOut').textContent = `Loaded: ${file.name} (${(file.size / 1048576).toFixed(1)} MB). Click Convert.`;
      await chrome.storage.local.remove(['pendingPdfUrl', 'pendingPdfName']);
    } else $('spOut').textContent = 'No pending PDF found.';
  } catch (e) { $('spOut').textContent = 'Pending load failed: ' + (e.message || e); }
}

async function convert() {
  if (!file) { const f = $('spFile').files[0]; if (f) file = f; }
  if (!file) { $('spOut').textContent = 'Choose a file first.'; return; }
  $('spOut').textContent = 'Converting locally…';
  try {
    const res = await converter.convert(file, applyPresetToOptions($('spPreset').value, {
      compressionMode: $('spMode').value, tokenBudget: 8000, maxBytes: 200 * 1024 * 1024,
      includeNotes: true, includeHidden: true, attemptOcr: true, ocrLang: 'eng'
    }), () => {});
    markdown = res.markdown;
    const srcType = (res.metadata && res.metadata.type) || 'file';
    $('spStats').textContent = `${srcType.toUpperCase()} • ${res.stats.optimizedTokens} toks • -${res.stats.savingsPercent}%`;
    $('spOut').textContent = markdown.slice(0, 4000) + (markdown.length > 4000 ? '\n\n…' : '');
  } catch (e) { $('spOut').textContent = 'Failed: ' + (e.message || e); }
}

$('spPending')?.addEventListener('click', pending);
$('spConvert')?.addEventListener('click', convert);
$('spFile')?.addEventListener('change', (e) => { if (e.target.files[0]) { file = e.target.files[0]; $('spOut').textContent = `Loaded: ${file.name}. Click Convert.`; } });
$('spCopy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(markdown); $('spCopy').textContent = 'Copied!'; setTimeout(() => $('spCopy').textContent = 'Copy', 1500); } catch { /* ignore */ } });
$('spDownload')?.addEventListener('click', () => {
  if (!markdown || !file) return;
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const reader = new FileReader();
  reader.onloadend = () => chrome.downloads.download({ url: reader.result, filename: sanitizeDownloadFilename(file.name), saveAs: true });
  reader.readAsDataURL(blob);
});
pending();
