/**
 * Cross-cutting: background message handlers, manifest contract,
 * privacy (PS1–PS5). Native OS context-menu clicks and the OS-level
 * keyboard shortcut cannot be synthesized by Playwright and are
 * covered as documented-manual checks at the bottom.
 */
import { test, expect, uploadAndWait, copyFullMarkdown, popupUrl, DIST_DIR } from './utils/extension';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(DIST_DIR, '..');

test('CM-handler: background stores pending PDF on convertPdf message', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  try {
    await page.goto(popupUrl(extensionId));
    await page.evaluate(() => chrome.storage.local.remove(['pendingPdfUrl', 'pendingPdfName']));
    await page.evaluate(() => chrome.runtime.sendMessage({
      action: 'convertPdf', url: 'https://e2e.local/menu.pdf', filename: 'menu.pdf'
    }));
    await page.waitForFunction(async () => {
      const r = await chrome.storage.local.get('pendingPdfUrl');
      return r.pendingPdfUrl === 'https://e2e.local/menu.pdf';
    }, { timeout: 10000 });
  } finally {
    await page.close();
  }
});

test('KS1/manifest: shortcut, side panel, and least-privilege contract', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'manifest.json'), 'utf8'));
  expect(manifest.commands?._execute_action?.suggested_key?.default).toBe('Ctrl+Shift+T');
  expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
  expect(manifest.optional_host_permissions).toContain('<all_urls>');
  expect(manifest.host_permissions ?? []).not.toContain('<all_urls>');
  expect(manifest.permissions).not.toContain('tabs');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  expect(manifest.version).toBe(pkg.version);
});

test('PS1/PS2: zero third-party requests during open + conversion', async ({ popupPage: page }) => {
  const thirdParty: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/.test(url)) {
      thirdParty.push(url);
    }
  });
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor();
  await uploadAndWait(page, 'simple.pdf');
  expect(thirdParty).toEqual([]);
});

test('PS3: no CSP or fetch errors in console during conversion', async ({ popupPage: page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Failed to fetch|dynamically imported module/i.test(msg.text())) {
      problems.push(msg.text());
    }
  });
  page.on('pageerror', (err) => problems.push(String(err)));
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor();
  await uploadAndWait(page, 'table.pdf');
  expect(problems).toEqual([]);
});

test('PS4: exported markdown never contains branding footer', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'research.pdf');
  const md = await copyFullMarkdown(page);
  expect(md).not.toContain('Converted by TokenTrim');
});

test.fixme('MANUAL CM1/CM2: native right-click menu items (OS menu not automatable)', async () => {
  // 1. Serve a page with <a href=".../*.pdf">, right-click → "Convert PDF for AI chat".
  // 2. Assert side panel opens with the pending file ready to convert.
  // 3. Open a PDF tab, right-click page → "Convert this PDF for AI chat" → same.
});

test.fixme('MANUAL KS1-live: press Ctrl+Shift+T and confirm the popup opens focused', async () => {
  // Manifest declaration is asserted above; the OS key dispatch is manual.
});


