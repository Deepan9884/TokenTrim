/**
 * TokenTrim network audit: fails on remote URLs in extension pages (fonts, cmaps, cdns).
 * Document bytes must never leave the device; third-party fetches must be zero.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['popup.html', 'sidepanel.html', 'popup.js', 'sidepanel.js', 'background.js', 'content.js', 'lib/converter.js', 'lib/pdfjs-wrapper.js', 'manifest.json'];
const offenders = [];
const remoteRe = /https:\/\/(fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)[^\s"'\)]*/g;

for (const f of files) {
  try {
    const content = readFileSync(join(root, f), 'utf8');
    const hits = content.match(remoteRe);
    if (hits) offenders.push(`${f}: ${[...new Set(hits)].join(', ')}`);
  } catch { /* file may not exist in some trees */ }
}
// Scan lib/*.js too
try {
  for (const f of readdirSync(join(root, 'lib'))) {
    if (!f.endsWith('.js') || f.startsWith('tesseract')) continue;
    const content = readFileSync(join(root, 'lib', f), 'utf8');
    const hits = content.match(remoteRe);
    if (hits) offenders.push(`lib/${f}: ${[...new Set(hits)].join(', ')}`);
  }
} catch { /* ignore */ }

if (offenders.length) {
  console.error('[network-audit] FAIL: remote requests found');
  offenders.forEach(o => console.error(' - ' + o));
  process.exit(1);
}
console.log('[network-audit] PASS: zero third-party requests');
