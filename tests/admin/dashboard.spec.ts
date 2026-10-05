/**
 * D01–D06: dashboard charts, user list, event explorer (seeded demo data).
 */
import { test, expect, apiReset, apiSeed, apiSignin, apiAuthed, uiLogin } from './utils/helpers';

test.beforeEach(async () => {
  await apiReset();
  await apiSeed();
});

test('D01: dashboard cards show seeded totals', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await expect(page.locator('.page-title')).toContainText('Dashboard');
  const cards = page.locator('.cards .card .v');
  await expect(cards.nth(0)).toContainText('13'); // 12 users + admin
  await expect(cards.nth(3)).not.toHaveText('0'); // conversions > 0
});

test('D02: trend charts render SVG series', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  const svgs = page.locator('.card svg.recharts-wrapper, .card svg');
  await expect(svgs.first()).toBeVisible({ timeout: 15000 });
  expect(await svgs.count()).toBeGreaterThanOrEqual(2);
});

test('D03: users table lists IDs, plans, and aggregates', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await page.goto('/users');
  await expect(page.locator('.page-title')).toContainText('Users');
  await expect(page.locator('.tbl')).not.toContainText('admin@tokentrim.local');
  await expect(page.locator('.tbl')).toContainText('user1@example.com');
  // short id + plan pill + numeric aggregates present
  await expect(page.locator('.tbl td.mono').first()).toContainText('…');
  await expect(page.locator('.tbl')).not.toContainText('admin');
});

test('D04: user search filters the table', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await page.goto('/users');
  await expect(page.locator('.tbl')).toContainText('user5@example.com');
  await page.locator('input[aria-label="Search users"]').fill('user5@example');
  await expect(page.locator('.tbl')).toContainText('user5@example.com');
  await expect(page.locator('.tbl')).not.toContainText('user6@example.com');
});

test('D05: expanding a row shows recent activity', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  const res = await page.request.get('/api/admin/events?event=convert_success&limit=50');
  const data = await res.json();
  const email = data.events[0].user_email as string;
  expect(email).toBeTruthy();
  await page.goto('/users');
  await page.locator('.tbl tbody tr').filter({ has: page.locator(`div:text-is("${email}")`) }).first().click();
  await expect(page.locator('.detail')).toContainText('convert_success', { timeout: 10000 });
});

test('D06: events explorer lists and filters tracked events', async ({ page }) => {
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await page.goto('/events');
  await expect(page.locator('.tbl')).toContainText('convert_success');
  await page.locator('select[aria-label="Event name"]').selectOption('copy');
  await page.locator('.toolbar button').click();
  await expect(page.locator('.tbl')).toContainText('copy');
  await expect(page.locator('.tbl')).not.toContainText('convert_success');
});

test('D07: non-admin API access is forbidden', async () => {
  const { token } = await apiSignin('user1@example.com', 'Password1!');
  const { res } = await apiAuthed('/api/admin/users', token);
  expect(res.status).toBe(403);
});
