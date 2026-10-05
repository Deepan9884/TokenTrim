/**
 * A01–A09: creator auth — signup API (email+password+4-digit key, used by
 * the extension), signin, signout, forgot-password via key, validation.
 * The admin web panel itself is sign-in only (no public /signup page).
 */
import { test, expect, apiReset, apiSignup, uiLogin } from './utils/helpers';

test.beforeEach(async () => {
  await apiReset();
});

test('A01: signup API creates a working account (non-admin bounces to login)', async ({ page }) => {
  await apiSignup('creator1@test.local', 'Creator123', '4321', 'Creator One');
  // Non-admin creator is bounced back to login by the app guard
  await page.goto('/login');
  await page.locator('#email').fill('creator1@test.local');
  await page.locator('#password').fill('Creator123');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.form-err')).toContainText(/not an admin/i, { timeout: 10000 });
  // Prove the account + password actually work via the API
  const ok = await page.evaluate(async () => {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator1@test.local', password: 'Creator123' })
    });
    const data = await res.json();
    return res.ok && data.user?.email === 'creator1@test.local';
  });
  expect(ok).toBe(true);
});

test('A02: duplicate signup is rejected', async ({ page }) => {
  await apiSignup('dupe@test.local', 'Dupepass1', '1111');
  await page.goto('/login');
  const dup = await page.evaluate(async () => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@test.local', password: 'Dupepass1', pin: '2222' })
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, error: String(data.error || '') };
  });
  expect(dup.status).toBe(409);
  expect(dup.error).toMatch(/already exists/i);
});

test('A03: signin works, wrong password does not', async ({ page }) => {
  await apiSignup('signin@test.local', 'Signin123', '3333');
  await page.goto('/login');
  await page.locator('#email').fill('signin@test.local');
  await page.locator('#password').fill('wrongpass1');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.form-err')).toContainText(/incorrect/i, { timeout: 10000 });
  await page.locator('#password').fill('Signin123');
  await page.locator('button[type="submit"]').click();
  // Non-admin → bounced to login with "not admin" error (proves auth succeeded)
  await expect(page.locator('.form-err')).toContainText(/not an admin/i, { timeout: 10000 });
});

test('A04: admin can sign in and stay on dashboard', async ({ page }) => {
  await apiSignup('admin@tokentrim.local', 'admin123', '1234', 'Creator');
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await expect(page.locator('.page-title')).toContainText('Dashboard');
  await expect(page.locator('.side .who')).toContainText('admin@tokentrim.local');
});

test('A05: forgot flow — wrong key rejected, right key resets', async ({ page }) => {
  await apiSignup('forgot@test.local', 'Forgot123', '5678');
  await page.goto('/forgot');
  await page.locator('#email').fill('forgot@test.local');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#pin')).toBeVisible({ timeout: 10000 });

  await page.locator('#pin').fill('0000');
  await page.locator('#newPassword').fill('Brandnew1');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.form-err')).toContainText(/incorrect/i, { timeout: 10000 });

  await page.locator('#pin').fill('5678');
  await page.locator('#newPassword').fill('Brandnew1');
  await page.locator('button[type="submit"]').click();
  // Reset auto-signs-in; non-admin bounces to login without error
  await page.waitForURL('**/login', { timeout: 15000 });
  await expect(page.locator('.form-err')).toHaveCount(0);
});

test('A06: new password works, old one does not (non-admin gets "not admin" error)', async ({ page }) => {
  await apiSignup('rotate@test.local', 'Rotate123', '7777');
  await page.goto('/forgot');
  await page.locator('#email').fill('rotate@test.local');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#pin')).toBeVisible({ timeout: 10000 });
  await page.locator('#pin').fill('7777');
  await page.locator('#newPassword').fill('Rotated99');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/login', { timeout: 15000 });

  await page.goto('/login');
  await page.locator('#email').fill('rotate@test.local');
  await page.locator('#password').fill('Rotate123');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.form-err')).toContainText(/incorrect/i, { timeout: 10000 });
  await page.locator('#password').fill('Rotated99');
  await page.locator('button[type="submit"]').click();
  // Non-admin → "not admin" error
  await expect(page.locator('.form-err')).toContainText(/not an admin/i, { timeout: 10000 });
});

test('A07: signup validation — bad email, short password, bad key', async ({ page }) => {
  await page.goto('/login');
  async function trySignup(body: Record<string, string>) {
    return page.evaluate(async (payload: Record<string, string>) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, error: String(data.error || '') };
    }, body);
  }

  // bad key rejected
  const badPin = await trySignup({ email: 'ok@test.local', password: 'Password1', pin: '12' });
  expect(badPin.status).toBe(400);
  expect(badPin.error).toMatch(/exactly 4 digits/i);

  // bad email rejected
  const badEmail = await trySignup({ email: 'not-an-email', password: 'Password1', pin: '1234' });
  expect(badEmail.status).toBe(400);
  expect(badEmail.error).toMatch(/valid email/i);

  // short password rejected
  const shortPass = await trySignup({ email: 'ok@test.local', password: 'short', pin: '1234' });
  expect(shortPass.status).toBe(400);
  expect(shortPass.error).toMatch(/at least 8/i);
});

test('A09: admin panel has no public sign-up page', async ({ page }) => {
  await page.goto('/signup');
  await page.waitForURL('**/login', { timeout: 15000 });
  await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /sign up/i })).toHaveCount(0);
});

test('A08: signout returns to login and dashboard is guarded', async ({ page }) => {
  await apiSignup('admin@tokentrim.local', 'admin123', '1234', 'Creator');
  await uiLogin(page, 'admin@tokentrim.local', 'admin123');
  await expect(page.locator('.page-title')).toContainText('Dashboard');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login', { timeout: 15000 });
  await page.goto('/dashboard');
  await page.waitForURL('**/login', { timeout: 15000 });
});
