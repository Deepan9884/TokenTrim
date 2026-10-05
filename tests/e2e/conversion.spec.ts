/**
 * C01–C06 + error paths: core PDF/DOCX conversion in the popup.
 */
import { test, expect, uploadAndWait, dropAndWait, loadSyntheticFile, fixturePath } from './utils/extension';

test('C02: browse-upload PDF converts to markdown with token stats', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');
  await expect(page.locator('#originalTokens')).toContainText('tokens');
  await expect(page.locator('#optimizedTokens')).toContainText('tokens');
  await expect(page.locator('#tokenSavings')).toContainText(/tokens saved|increase/);
  await expect(page.locator('#mdFilename')).toContainText('simple.md');
});

test('C01: drag-drop onto dropzone converts (real drop path)', async ({ popupPage: page }) => {
  await dropAndWait(page, 'simple.pdf');
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');
});

test('C03: DOCX converts with DOCX badge and table', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.docx');
  await expect(page.locator('#fileBadge')).toContainText('DOCX');
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim DOCX');
  await expect(page.locator('#markdownPreview')).toContainText('Alpha');
});

test('C04: oversized file rejected with FILE_TOO_LARGE', async ({ popupPage: page }) => {
  await loadSyntheticFile(page, 'big.pdf', 60 * 1024 * 1024, 'application/pdf');
  await expect(page.locator('#error-banner')).toContainText('exceeds');
});

test('C05: unsupported type rejected with INVALID_TYPE', async ({ popupPage: page }) => {
  await loadSyntheticFile(page, 'notes.exe', 100, 'application/x-msdownload');
  await expect(page.locator('#error-banner')).toContainText(/supported file/i);
});

test('C06: zero-byte file rejected with EMPTY_FILE', async ({ popupPage: page }) => {
  await page.locator('#fileInput').setInputFiles(fixturePath('empty.pdf'));
  await expect(page.locator('#error-banner')).toContainText(/extractable text|No file|empty/i);
});

test('ERR: scanned/image PDF surfaces no-text guidance', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'scanned.pdf', { success: false });
  await expect(page.locator('#error-banner')).toContainText(/extractable text|OCR/i);
});

test('ERR: corrupt PDF surfaces actionable error, never junk output', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'corrupt.pdf', { success: false });
  await expect(page.locator('#error-banner')).toContainText(/corrupt|convert|engine/i);
  await expect(page.locator('#view-success.hidden')).toHaveCount(1);
});

test('ERR: password-protected PDF maps to PASSWORD_PROTECTED', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'password.pdf', { success: false });
  await expect(page.locator('#error-banner')).toContainText(/password-protected/i);
});
