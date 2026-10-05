/**
 * P01–P09: settings modal, functional presets, persistence, license.
 */
import { test, expect, uploadAndWait } from './utils/extension';

test('P01/P02: settings opens from header gear and footer link', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsModal:not(.hidden)')).toBeVisible();
  await page.locator('#saveSettingsBtn').click();
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#presetsBtn').click();
  await expect(page.locator('#settingsModal:not(.hidden)')).toBeVisible();
});

test('P03: switching preset updates description immediately', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await page.locator('.preset-pill[data-preset="chatgpt"]').click();
  await expect(page.locator('#presetDesc')).toContainText('GPT');
  await expect(page.locator('#quickPreset')).toHaveValue('chatgpt');
});

test('P04: preset persists across popup reloads', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await page.locator('.preset-pill[data-preset="gemini"]').click();
  await page.locator('#saveSettingsBtn').click();
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('.preset-pill[data-preset="gemini"].active')).toHaveCount(1);
});

test('P05: default toggles persist into loaded-state checkboxes', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await page.locator('#settingDefaultStrip').uncheck();
  await page.locator('#saveSettingsBtn').click();
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor();
  await expect(page.locator('#settingDefaultStrip')).not.toBeChecked();
});

test('P06: telemetry opt-in persists a local flag only', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await page.locator('#telemetryToggle').check();
  await page.locator('#saveSettingsBtn').click();
  const enabled = await page.evaluate(() => chrome.storage.local.get('tokentrim_telemetry_enabled'));
  expect(enabled.tokentrim_telemetry_enabled).toBe(true);
});

test('P07: OCR pilot toggle persists to feature flags', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await page.locator('#ocrToggle').check();
  await page.locator('#saveSettingsBtn').click();
  const flags = await page.evaluate(() => chrome.storage.local.get('tokentrim_flags'));
  expect(flags.tokentrim_flags.ocrEnabled).toBe(true);
});

test('P08: plan section displays current Free plan and removes license input', async ({ popupPage: page }) => {
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsPlanSection')).toBeVisible();
  await expect(page.locator('#planName')).toContainText('Free Plan');
  await expect(page.locator('#planLimitText')).toContainText('50MB');
  await expect(page.locator('#licenseInput')).toHaveCount(0);
  await expect(page.locator('#licenseActivate')).toHaveCount(0);
});

test('P09: plan section displays Pro plan when user is pro', async ({ popupPage: page }) => {
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_license: { key: 'TT-PRO-TESTKEY12345', at: Date.now() } }));
  await page.reload();
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#planName')).toContainText('Pro Plan');
  await expect(page.locator('#planLimitText')).toContainText('200MB');
  await expect(page.locator('#sizeHint')).toContainText('200MB');
});
