/**
 * O01–O15: tuning & filters (loaded state).
 */
import { test, expect, uploadAndWait, uploadForManual, copyFullMarkdown, fixturePath } from './utils/extension';

test('O01: disabling strip-headers keeps boilerplate', async ({ popupPage: page }) => {
  await uploadForManual(page, 'headers.pdf');
  await page.locator('#stripHeadersOption').uncheck();
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Acme Report');
});

test('O01b: enabling strip-headers removes repeated boilerplate', async ({ popupPage: page }) => {
  await uploadForManual(page, 'headers.pdf');
  await expect(page.locator('#stripHeadersOption')).toBeChecked();
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).not.toContain('Acme Report');
  expect(md).toContain('unique alpha');
});

test('O02: disabling table formatting keeps raw table text', async ({ popupPage: page }) => {
  await uploadForManual(page, 'table.pdf');
  await page.locator('#formatTablesOption').uncheck();
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Alpha');
  expect(md).not.toContain('| --- |');
});

test('O02b: table optimizer emits compact markdown + drops nothing meaningful', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'table.pdf');
  const md = await copyFullMarkdown(page);
  expect(md).toContain('|');
  expect(md).toContain('Beta');
});

test('O03/O07/O08: aggressive < extractive <= lossless in length', async ({ popupPage: page }) => {
  const lengths: Record<string, number> = {};
  for (const mode of ['lossless', 'extractive', 'aggressive']) {
    await page.goto(page.url());
    await page.evaluate(() => chrome.storage.local.set({ tokentrim_onboarded: true }));
    await page.reload();
    await page.locator('#view-empty:not(.hidden)').waitFor();
    await uploadForManual(page, 'large.pdf');
    await page.locator('#modeSelect').selectOption(mode);
    await page.locator('#budgetSelect').selectOption('0');
    await page.locator('#convertBtn').click();
    await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
    lengths[mode] = (await copyFullMarkdown(page)).length;
  }
  expect(lengths.aggressive).toBeLessThan(lengths.lossless);
  expect(lengths.extractive).toBeLessThanOrEqual(lengths.lossless);
});

test('O09/O10: token budget enforced with truncation warning', async ({ popupPage: page }) => {
  await uploadForManual(page, 'xlarge.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#budgetSelect').selectOption('4000');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const optText = await page.locator('#optimizedTokens').innerText();
  const tokens = parseInt(optText.replace(/[^0-9]/g, ''), 10);
  expect(tokens).toBeLessThanOrEqual(4400);
  await expect(page.locator('#warningsList')).toContainText(/budget/i);
});

test('O11/O12: document-type presets keep boosted terms (lossless)', async ({ popupPage: page }) => {
  await uploadForManual(page, 'research.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#docTypeSelect').selectOption('research');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Smith 2023');
  expect(md).toContain('500 users');
});

test('O13: single-page selection restricts output', async ({ popupPage: page }) => {
  await uploadForManual(page, 'headers.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#pageRangeInput').fill('2');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('beta');
  expect(md).not.toContain('alpha');
  expect(md).not.toContain('gamma');
  await expect(page.locator('#warningsList')).toContainText(/Page range 2 extracted \(1 of 3 pages\)/);
});

test('O13b: multi-range "1-2, 20" extracts exactly those pages', async ({ popupPage: page }) => {
  await uploadForManual(page, 'large.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#pageRangeInput').fill('1-2, 20');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('1000');
  expect(md).toContain('1001');
  expect(md).toContain('1019');
  expect(md).not.toContain('1010');
  await expect(page.locator('#warningsList')).toContainText(/Page range 1-2, 20 extracted \(3 of 20 pages\)/);
});

test('O13c: invalid range shows inline error and blocks convert', async ({ popupPage: page }) => {
  await uploadForManual(page, 'headers.pdf');
  await page.locator('#pageRangeInput').fill('abc');
  await expect(page.locator('#pageRangeError:not(.hidden)')).toContainText(/invalid/i);
  await page.locator('#convertBtn').click();
  await expect(page.locator('#error-banner')).toContainText(/Invalid page selection/);
  await expect(page.locator('#view-success.hidden')).toHaveCount(1);
});

test('O13d: out-of-range pages surface document page count', async ({ popupPage: page }) => {
  await uploadForManual(page, 'simple.pdf');
  await page.locator('#pageRangeInput').fill('99-100');
  await page.locator('#convertBtn').click();
  await expect(page.locator('#error-banner')).toContainText(/Invalid page selection/);
  await expect(page.locator('#error-banner')).toContainText(/1 page/);
});

test('O14: focus query keeps relevant sections', async ({ popupPage: page }) => {
  await uploadForManual(page, 'contract.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#queryInput').fill('payment terms late fee');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Net 30');
});

test('O14b: no-match query keeps full document with honest warning', async ({ popupPage: page }) => {
  await uploadForManual(page, 'contract.pdf');
  await page.locator('#modeSelect').selectOption('lossless');
  await page.locator('#queryInput').fill('quantum zebras xyzzy');
  await page.locator('#convertBtn').click();
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  const md = await copyFullMarkdown(page);
  expect(md).toContain('Net 30');
  expect(md).toContain('Liability');
  await expect(page.locator('#warningsList')).toContainText(/no sections matched/i);
});

test('O15: quick preset switch applies to next conversion', async ({ popupPage: page }) => {
  await page.locator('#bannerPdf').click();
  await page.locator('#quickPreset').selectOption('local');
  await uploadAndWait(page, 'simple.pdf');
  await expect(page.locator('#modelBadge')).toContainText('Local');
});
