/**
 * B01–B04: batch conversion queue.
 */
import { test, expect, fixturePath } from './utils/extension';

test('B01/B02: queue of 3 files processes sequentially to done', async ({ popupPage: page }) => {
  await page.locator('#batchInput').setInputFiles([
    fixturePath('simple.pdf'),
    fixturePath('table.pdf'),
    fixturePath('contract.pdf')
  ]);
  await expect(page.locator('#batchList:not(.hidden)')).toBeVisible();
  await expect(page.locator('#batchList')).toContainText('simple.pdf');
  await page.waitForFunction(() => {
    const el = document.getElementById('batchList');
    return el && (el.textContent?.match(/done/g) || []).length >= 3;
  }, { timeout: 60000 });
  await expect(page.locator('#batchList')).toContainText('tokens');
});

test('B03: use-this-file promotes a batch result to success view', async ({ popupPage: page }) => {
  await page.locator('#batchInput').setInputFiles([fixturePath('simple.pdf')]);
  await page.waitForFunction(() => {
    const el = document.getElementById('batchList');
    return el && (el.textContent?.match(/done/g) || []).length >= 1;
  }, { timeout: 60000 });
  await page.locator('#batchList button:has-text("Use this file")').first().click();
  await expect(page.locator('#view-success:not(.hidden)')).toBeVisible();
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');
});

test('B04: corrupt file in batch surfaces per-item error', async ({ popupPage: page }) => {
  await page.locator('#batchInput').setInputFiles([
    fixturePath('simple.pdf'),
    fixturePath('corrupt.pdf')
  ]);
  await page.waitForFunction(() => {
    const el = document.getElementById('batchList');
    const t = el?.textContent || '';
    return t.includes('done') && t.includes('error');
  }, { timeout: 60000 });
  await expect(page.locator('#batchList')).toContainText('error');
});
