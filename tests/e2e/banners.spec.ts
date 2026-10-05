/**
 * E2E test for the 4 Format Banners and Dedicated Conversion Sections
 */
import { test, expect, fixturePath } from './utils/extension';

test('B01: 4 format banners render with illustrations, badges, and titles', async ({ popupPage: page }) => {
  await expect(page.locator('#bannerPdf')).toBeVisible();
  await expect(page.locator('#bannerDocx')).toBeVisible();
  await expect(page.locator('#bannerPpt')).toBeVisible();
  await expect(page.locator('#bannerImg')).toBeVisible();

  // Verify illustrations
  await expect(page.locator('#bannerPdf img')).toHaveAttribute('src', 'icons/banner-pdf.svg');
  await expect(page.locator('#bannerDocx img')).toHaveAttribute('src', 'icons/banner-docx.svg');
  await expect(page.locator('#bannerPpt img')).toHaveAttribute('src', 'icons/banner-ppt.svg');
  await expect(page.locator('#bannerImg img')).toHaveAttribute('src', 'icons/banner-img.svg');

  // Verify titles and subtle tier badges
  await expect(page.locator('#bannerPdf')).toContainText('PDF Document');
  await expect(page.locator('#bannerDocx')).toContainText('Word DOCX');
  await expect(page.locator('#bannerPpt')).toContainText(/10 slides/i);
  await expect(page.locator('#bannerImg')).toContainText(/PRO/i);
});

test('B02: clicking PDF banner enters PDF section, back button returns to banners', async ({ popupPage: page }) => {
  await page.locator('#bannerPdf').click();
  await expect(page.locator('#formatSectionPane')).toBeVisible();
  await expect(page.locator('#formatHubPane')).toBeHidden();
  await expect(page.locator('#sectionTitle')).toContainText('PDF Converter');
  await expect(page.locator('#sectionDropTitle')).toContainText('Drop your PDF file here');

  // Click back
  await page.locator('#sectionBackBtn').click();
  await expect(page.locator('#formatHubPane')).toBeVisible();
  await expect(page.locator('#formatSectionPane')).toBeHidden();
});

test('B03: clicking PPT banner enters PPT section with Free 10-slide limit notice', async ({ popupPage: page }) => {
  await page.locator('#bannerPpt').click();
  await expect(page.locator('#formatSectionPane')).toBeVisible();
  await expect(page.locator('#sectionTitle')).toContainText('PowerPoint');
  await expect(page.locator('#sectionPptLimitNotice')).toBeVisible();
  await expect(page.locator('#sectionPptLimitNotice')).toContainText(/10 slides/i);
});

test('B04: clicking Image banner on Free tier opens Pro upgrade modal', async ({ popupPage: page }) => {
  await page.locator('#bannerImg').click();
  await expect(page.locator('#proUpgradeModal')).toBeVisible();
  await expect(page.locator('#proModalTitle')).toContainText('TokenTrim Pro');
  await expect(page.locator('.pro-hero-title')).toContainText('Unlock Image & Pro Power');

  // Close modal via maybe later button
  await page.locator('#proModalCloseBtn').click();
  await expect(page.locator('#proUpgradeModal')).toBeHidden();
});

test('B05: activating Pro key unlocks Image conversion', async ({ popupPage: page }) => {
  await page.locator('#bannerImg').click();
  await expect(page.locator('#proUpgradeModal')).toBeVisible();

  // Enter mock valid pro key (starts with TT-PRO- and >= 16 chars)
  await page.locator('#proModalKeyInput').fill('TT-PRO-1234-5678-ABCD');
  await page.locator('#proModalActivateBtn').click();

  // Modal should close and Image section should open
  await expect(page.locator('#proUpgradeModal')).toBeHidden();
  await expect(page.locator('#formatSectionPane')).toBeVisible();
  await expect(page.locator('#sectionTitle')).toContainText('Image');
});

test('B06: uploading in PDF section triggers conversion to success view', async ({ popupPage: page }) => {
  await page.locator('#bannerPdf').click();
  await expect(page.locator('#formatSectionPane')).toBeVisible();

  await page.locator('#sectionFileInput').setInputFiles(fixturePath('simple.pdf'));
  await page.locator('#view-success:not(.hidden)').waitFor({ timeout: 30000 });
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');
});
