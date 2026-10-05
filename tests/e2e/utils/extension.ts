/**
 * Shared Playwright fixtures for TokenTrim extension E2E.
 *
 * - `extContext`: worker-scoped persistent Chromium with dist/ loaded.
 * - `extensionId`: worker-scoped MV3 extension id (from service worker URL).
 * - `popupPage`: test-scoped fresh popup with reset storage + onboarding done.
 *
 * State is reset before every test (storage cleared, IndexedDB dropped),
 * so tests are isolated despite sharing one browser context.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DIST_DIR = path.resolve(HERE, '..', '..', '..', 'dist');
export const FIXTURES_DIR = path.resolve(HERE, '..', 'fixtures');

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

type WorkerFixtures = {
  extContext: BrowserContext;
  extensionId: string;
};

type TestFixtures = {
  popupPage: Page;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extContext: [async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentrim-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${DIST_DIR}`,
        `--load-extension=${DIST_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage'
      ]
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
    const extensionId = sw.url().split('/')[2];
    if (!extensionId) throw new Error('Could not determine extension id from ' + sw.url());
    await use(context);
    await context.close();
  }, { scope: 'worker' }],

  extensionId: [async ({ extContext }, use) => {
    const sw = extContext.serviceWorkers()[0];
    await use(sw.url().split('/')[2]);
  }, { scope: 'worker' }],

  popupPage: async ({ extContext, extensionId }, use) => {
    const page = await extContext.newPage();
    await resetPopup(page, extensionId);
    // MV3 popups close on blur — pin focus immediately and keep it.
    await page.bringToFront().catch(() => {});
    const keepAlive = setInterval(() => page.bringToFront().catch(() => {}), 500);
    try {
      await use(page);
    } finally {
      clearInterval(keepAlive);
      await page.close().catch(() => {});
    }
  },
});

export const expect = test.expect;

export function popupUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/popup.html`;
}

export function sidepanelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/sidepanel.html`;
}

/** Clear storage + history DB, mark onboarding done, land on empty view. */
export async function resetPopup(page: Page, extensionId: string): Promise<void> {
  await page.goto(popupUrl(extensionId));
  await page.evaluate(async () => {
    await chrome.storage.local.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('tokentrim');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.goto(popupUrl(extensionId));
  // Baseline persisted settings so tests are isolated: defaults ON, preset
  // Claude, free plan, telemetry/OCR off, onboarding done.
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_onboarded: true }));
  await page.evaluate(() => chrome.storage.local.set({
    tokentrim_preset: 'claude',
    tokentrim_defaults: { stripHeaders: true, formatTables: true },
    tokentrim_flags: {},
    tokentrim_telemetry_enabled: false
  }));
  await page.evaluate(() => chrome.storage.local.remove(['tokentrim_license']));
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor({ timeout: 15000 });
}

/** Upload via hidden file input; wait for success view or error banner. */
export async function uploadAndWait(page: Page, fileName: string, opts: { success?: boolean } = {}): Promise<void> {
  const wantSuccess = opts.success !== false;
  await page.locator('#fileInput').setInputFiles(fixturePath(fileName));
  if (wantSuccess) {
    await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  } else {
    await page.locator('#error-banner').waitFor({ timeout: 30000 });
  }
}

/**
 * Manual mode: disable the 100ms auto-convert, upload, and stop on the
 * loaded view so the test can tune options before clicking Convert.
 * Returns after `#view-loaded` is visible.
 */
export async function uploadForManual(page: Page, fileName: string): Promise<void> {
  await page.evaluate(() => { (window as unknown as { __TT_MANUAL: boolean }).__TT_MANUAL = true; });
  await page.locator('#fileInput').setInputFiles(fixturePath(fileName));
  await page.locator('#view-loaded:not(.hidden)').waitFor({ timeout: 15000 });
  await expect(page.locator('#convertBtn')).toBeVisible();
}

/** Real drag-drop path: construct a File in-page and drop it on the dropzone. */
export async function dropAndWait(page: Page, fileName: string): Promise<void> {
  const buf = fs.readFileSync(fixturePath(fileName));
  await page.evaluate(async ([bytes, name, type]) => {
    const file = new File([new Uint8Array(bytes)], name, { type });
    const zone = document.getElementById('dropzone')!;
    const dt = new DataTransfer();
    dt.items.add(file);
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [Array.from(buf), fileName, fileName.endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf'] as const);
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
}

/** Copy button → return full clipboard markdown. */
export async function copyFullMarkdown(page: Page): Promise<string> {
  await page.bringToFront().catch(() => {});
  await page.locator('#copyBtn').click();
  await expect(page.locator('#copyText')).toContainText('Copied!', { timeout: 10000 });
  const clip = await page.evaluate(async () => {
    try {
      return (await navigator.clipboard.readText()) || '';
    } catch {
      return '';
    }
  });
  if (clip) return clip;
  return page.evaluate(() => {
    const tt = (window as unknown as { TokenTrim?: { convertedMarkdown?: () => string } }).TokenTrim;
    return tt?.convertedMarkdown?.() || '';
  });
}

/** Stub chrome.downloads to capture the payload instead of opening Save-As. */
export async function stubDownloads(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __dl: unknown }).__dl = null;
    chrome.downloads.download = ((opts: chrome.downloads.DownloadOptions, cb?: (id: number) => void) => {
      (window as unknown as { __dl: unknown }).__dl = opts;
      cb?.(1);
    }) as typeof chrome.downloads.download;
  });
}

export async function getDownload(page: Page): Promise<{ filename: string; url: string }> {
  await page.waitForFunction(() => (window as unknown as { __dl: unknown }).__dl !== null, { timeout: 10000 });
  return page.evaluate(() => (window as unknown as { __dl: { filename: string; url: string } }).__dl);
}

/** Synthesize an in-page File of N bytes and pass it to the app's loader. */
export async function loadSyntheticFile(page: Page, name: string, size: number, type: string): Promise<void> {
  await page.evaluate(([n, s, t]) => {
    const file = new File([new Uint8Array(s)], n, { type: t });
    (window as unknown as { TokenTrim: { loadFile: (f: File) => void } }).TokenTrim.loadFile(file);
  }, [name, size, type] as const);
}
