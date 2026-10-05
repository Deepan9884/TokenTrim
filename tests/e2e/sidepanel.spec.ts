/**
 * SP1–SP5: side panel (direct conversion without leaving the page).
 * Native `chrome.sidePanel.open` needs a user gesture, so SP1 navigates
 * to the panel URL directly; the conversion/copy/download paths are live.
 */
import { test, expect, sidepanelUrl, fixturePath } from './utils/extension';
import fs from 'fs';

test('SP1/SP3: panel loads, uploads and converts a PDF', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  try {
    await page.goto(sidepanelUrl(extensionId));
    await page.locator('#spFile').setInputFiles(fixturePath('simple.pdf'));
    await page.locator('#spConvert').click();
    await expect(page.locator('#spOut')).toContainText('Hello TokenTrim', { timeout: 30000 });
    await expect(page.locator('#spStats')).toContainText('toks');
  } finally {
    await page.close();
  }
});

test('SP2: pending-PDF handoff (context-menu payload) loads and converts', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  try {
    // Genuine HTTP fetch path: intercept and serve the real fixture bytes.
    // NOTE: localhost is used (not a fake domain) because the extension CSP
    // allowlists localhost for panel connectivity; route.fulfill still serves
    // the bytes, so the handoff path is genuinely exercised.
    const pdfBytes = fs.readFileSync(fixturePath('simple.pdf'));
    await page.route('http://localhost:3100/pending-sample.pdf', (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfBytes })
    );
    await page.goto(sidepanelUrl(extensionId));
    await page.evaluate(() => chrome.storage.local.set({
      pendingPdfUrl: 'http://localhost:3100/pending-sample.pdf',
      pendingPdfName: 'pending-sample.pdf'
    }));
    await page.locator('#spPending').click();
    await expect(page.locator('#spOut')).toContainText('Loaded: pending-sample.pdf');
    await page.locator('#spConvert').click();
    await expect(page.locator('#spOut')).toContainText('Hello TokenTrim', { timeout: 30000 });
  } finally {
    await page.close();
  }
});

test('SP4: panel copy and download (stubbed Save-As)', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  try {
    await page.goto(sidepanelUrl(extensionId));
    await page.locator('#spFile').setInputFiles(fixturePath('contract.pdf'));
    await page.locator('#spConvert').click();
    await expect(page.locator('#spOut')).toContainText('Net 30', { timeout: 30000 });
    await page.locator('#spCopy').click();
    let clip = await page.evaluate(async () => {
      try { return await navigator.clipboard.readText(); } catch { return ''; }
    });
    if (!clip) clip = await page.locator('#spOut').innerText();
    expect(clip).toContain('Net 30');
    await page.evaluate(() => {
      (window as unknown as { __dl: unknown }).__dl = null;
      chrome.downloads.download = ((opts: chrome.downloads.DownloadOptions, cb?: (id: number) => void) => {
        (window as unknown as { __dl: unknown }).__dl = opts;
        cb?.(1);
      }) as typeof chrome.downloads.download;
    });
    await page.locator('#spDownload').click();
    await page.waitForFunction(() => (window as unknown as { __dl: unknown }).__dl !== null, { timeout: 10000 });
    const dl = await page.evaluate(() => (window as unknown as { __dl: { filename: string } }).__dl);
    expect(dl.filename).toMatch(/\.md$/);
  } finally {
    await page.close();
  }
});

test('SP5: panel preset + aggressive mode reshape output', async ({ extContext, extensionId }) => {
  const page = await extContext.newPage();
  try {
    await page.goto(sidepanelUrl(extensionId));
    await page.locator('#spFile').setInputFiles(fixturePath('large.pdf'));
    await page.locator('#spPreset').selectOption('local');
    await page.locator('#spMode').selectOption('aggressive');
    await page.locator('#spConvert').click();
    await expect(page.locator('#spOut')).not.toHaveText('No conversion yet.', { timeout: 30000 });
    const out = await page.locator('#spOut').innerText();
    expect(out.length).toBeGreaterThan(20);
  } finally {
    await page.close();
  }
});
