/**
 * TokenTrim permission audit: fails on <all_urls> host_permissions or overly broad content_scripts.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const errors = [];

if (manifest.host_permissions?.includes('<all_urls>')) {
  errors.push('host_permissions contains <all_urls>; use optional_host_permissions instead');
}
for (const cs of manifest.content_scripts || []) {
  if (cs.matches?.includes('<all_urls>')) errors.push('content_scripts matches <all_urls>; narrow to http/https');
}
const risky = ['tabs', 'webNavigation', 'debugger', 'proxy', 'privacy'];
for (const p of manifest.permissions || []) {
  if (risky.includes(p)) errors.push(`permission '${p}' needs justification`);
}
if (!manifest.commands?._execute_action) errors.push('missing _execute_action command (keyboard shortcut)');
if (!manifest.side_panel?.default_path) errors.push('missing side_panel.default_path');

if (errors.length) { console.error('[permission-audit] FAIL'); errors.forEach(e => console.error(' - ' + e)); process.exit(1); }
console.log('[permission-audit] PASS');
