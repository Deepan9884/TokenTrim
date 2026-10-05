/**
 * H01–H05: local history (IndexedDB, no cloud).
 */
import { test, expect, uploadAndWait } from './utils/extension';

test('H01: conversion appears in history', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#historyBtn').click();
  await expect(page.locator('#view-history:not(.hidden)')).toBeVisible();
  await expect(page.locator('#historyList')).toContainText('simple.pdf');
});

test('H02: re-open from history restores markdown', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#historyBtn').click();
  await page.locator('#historyList button:has-text("Open")').first().click();
  await expect(page.locator('#view-success:not(.hidden)')).toBeVisible();
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');
});

test('H03: delete removes a single history item', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#historyBtn').click();
  await page.locator('#historyList button:has-text("Delete")').first().click();
  await expect(page.locator('#historyList')).toContainText('No history yet');
});

test('H04: clear-all empties the history list', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.locator('#historyBtn').click();
  await expect(page.locator('#historyList')).toContainText('simple.pdf');
  await page.locator('#historyClearBtn').click();
  await expect(page.locator('#historyList')).toContainText('No history yet');
});

test('H05: history survives popup reload (same browser profile)', async ({ popupPage: page }) => {
  await uploadAndWait(page, 'simple.pdf');
  await page.reload();
  await page.locator('#view-empty:not(.hidden)').waitFor();
  await page.locator('#historyBtn').click();
  await expect(page.locator('#historyList')).toContainText('simple.pdf');
});
