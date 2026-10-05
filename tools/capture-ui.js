/**
 * TokenTrim UI capture — screenshots of every popup state for design review.
 * Run: npm run ui:shots  (requires `npm run build` first)
 * Output: test-results/ui/*.png
 */
import { chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'test-results', 'ui');
fs.mkdirSync(OUT, { recursive: true });

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentrim-ui-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: { width: 420, height: 640 },
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage'
  ]
});

let sw = context.serviceWorkers()[0];
if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
const id = sw.url().split('/')[2];
const popup = `chrome-extension://${id}/popup.html`;

const page = await context.newPage();
await page.goto(popup);
await page.evaluate(async () => {
  await chrome.storage.local.clear();
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase('tokentrim');
    r.onsuccess = r.onerror = r.onblocked = () => res(0);
  });
});
await page.goto(popup);
await page.evaluate(() => chrome.storage.local.set({ tokentrim_onboarded: true }));
await page.reload();
await page.locator('#view-empty:not(.hidden)').waitFor();
await page.screenshot({ path: path.join(OUT, '01-empty.png') });

// Loaded state (manual mode so it holds still for the camera)
await page.evaluate(() => { window.__TT_MANUAL = true; });
await page.locator('#fileInput').setInputFiles(path.join(ROOT, 'tests', 'e2e', 'fixtures', 'large.pdf'));
await page.locator('#view-loaded:not(.hidden)').waitFor();
await page.screenshot({ path: path.join(OUT, '02-loaded.png') });

// Converting state — xlarge (150pp) converts slowly; catch the cat mid-play
await page.locator('#removeFileBtn').click();
await page.locator('#fileInput').setInputFiles(path.join(ROOT, 'tests', 'e2e', 'fixtures', 'xlarge.pdf'));
await page.locator('#view-loaded:not(.hidden)').waitFor();
await page.locator('#convertBtn').click();
// Rapid-fire captures until one lands mid-conversion (it's a fast loader).
let caught = false;
for (let i = 0; i < 10 && !caught; i++) {
  await page.waitForTimeout(300);
  if (await page.locator('#view-converting:not(.hidden)').count()) {
    await page.screenshot({ path: path.join(OUT, '03-converting.png') });
    caught = true;
  }
}
if (!caught) throw new Error('missed the converting state');

// Success state
await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 60000 });
await page.screenshot({ path: path.join(OUT, '04-success.png') });

// Settings modal over success
await page.locator('#presetsBtn').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, '05-settings.png') });

await context.close();
console.log('UI shots saved to', OUT);
