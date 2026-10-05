/**
 * TokenTrim - Side Panel (direct conversion, no notification round-trip)
 */
import { converter } from './lib/converter.js';
import { applyPresetToOptions } from './lib/presets.js';

let file = null;
let markdown = '';

const $ = (id) => document.getElementById(id);

async function pending() {
  try {
    const r = await chrome.storage.local.get(['pendingPdfUrl', 'pendingPdfName']);
    if (r.pendingPdfUrl) {
      const resp = await fetch(r.pendingPdfUrl);
      const blob = await resp.blob();
      file = new File([blob], r.pendingPdfName || 'document.pdf', { type: 'application/pdf' });
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
  reader.onloadend = () => chrome.downloads.download({ url: reader.result, filename: file.name.replace(/\.(pdf|docx|pptx?|png|jpe?g|webp|gif|bmp|tiff?|xlsx?|csv|tsv|txt|md|markdown|html?|epub)$/i, '') + '.md', saveAs: true });
  reader.readAsDataURL(blob);
});
pending();
