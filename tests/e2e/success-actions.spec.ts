/**
 * S01–S08: success-state actions (copy, download, prompt packs, report).
 */
import { test, expect, uploadAndWait, uploadForManual, copyFullMarkdown, stubDownloads, getDownload } from './utils/extension';

test('S01: copy markdown puts full output on clipboard', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Hello TokenTrim');
  expect(md).not.toContain('Converted by TokenTrim');
});

test('S02: download saves a .md payload without native dialog', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await stubDownloads(page);
  await page.locator('#downloadBtn').click();
  const dl = await getDownload(page);
  expect(dl.filename).toMatch(/\.md$/);
  expect(dl.url.startsWith('data:')).toBe(true);
});

test('S03: prompt pack (summarize) wraps source as untrusted data', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'contract.pdf');
  await page.locator('#promptTaskSelect').selectOption('summarize');
  await page.locator('#promptPackBtn').click();
  await expect(page.locator('#promptPackBtn')).toContainText('Copied!', { timeout: 10000 });
  const pack = await page.evaluate(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) return clip;
    } catch {}
    const tt = (window as unknown as { TokenTrim?: { activePromptPack?: () => string } }).TokenTrim;
    return tt?.activePromptPack?.() || '';
  });
  expect(pack).toContain('<untrusted-document');
  expect(pack).toContain('Net 30');
  expect(pack).toMatch(/summariz/i);
});

test('S04: prompt pack (risks) asks for risks with citations', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'contract.pdf');
  await page.locator('#promptTaskSelect').selectOption('risks');
  await page.locator('#promptPackBtn').click();
  await expect(page.locator('#promptPackBtn')).toContainText('Copied!', { timeout: 10000 });
  const pack = await page.evaluate(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) return clip;
    } catch {}
    const tt = (window as unknown as { TokenTrim?: { activePromptPack?: () => string } }).TokenTrim;
    return tt?.activePromptPack?.() || '';
  });
  expect(pack).toMatch(/risk/i);
  expect(pack).toContain('</untrusted-document>');
});

test('S04b: prompt pack UI updates description and toggles live preview', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'contract.pdf');
  await expect(page.locator('#promptTaskDesc')).toContainText('Summarize this document in 8 bullets');
  
  await page.locator('#promptTaskSelect').selectOption('extract');
  await expect(page.locator('#promptTaskDesc')).toContainText('Extract key facts, figures');

  await page.locator('#promptPreviewToggle').click();
  await expect(page.locator('#promptPreviewBox:not(.hidden)')).toBeVisible();
  await expect(page.locator('#promptPreviewCode')).toContainText('<untrusted-document');
  await expect(page.locator('#promptPreviewCode')).toContainText('Extract key facts');

  await page.locator('#promptPreviewToggle').click();
  await expect(page.locator('#promptPreviewBox')).toHaveClass(/hidden/);
});

test('S05: convert-another resets to empty state', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#convertAnotherBtn').click();
  await expect(page.locator('#view-empty:not(.hidden)')).toBeVisible();
});

test('S06/S07: model badge + quality report on aggressive conversion', async ({ popupPage: page }) => {
  await uploadForManual(page, 'large.pdf');
  await page.locator('#modeSelect').selectOption('aggressive');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  await expect(page.locator('#modelBadge')).toContainText('aggressive');
  await expect(page.locator('#qualityReport:not(.hidden)')).toBeVisible();
  await expect(page.locator('#qualitySummary')).toContainText(/boilerplate|table|truncat|section/i);
});

test('S08: feedback buttons acknowledge without sending content', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#fbMissing').click();
  await expect(page.locator('#error-banner')).toContainText('Feedback noted: missing text');
});
