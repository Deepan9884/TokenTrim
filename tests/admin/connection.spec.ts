/**
 * X01–X03: live extension ↔ creator panel connection.
 * Runs under tests/admin (webServer provides the panel) but drives a real
 * extension popup via the shared extension fixtures (headed Chromium).
 */
import { test as extTest, expect, uploadAndWait } from '../e2e/utils/extension';

const ADMIN = process.env.ADMIN_BASE_URL || 'http://localhost:3100';

async function api(path: string, init?: RequestInit) {
  const res = await fetch(ADMIN + path, init);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

extTest.beforeEach(async () => {
  const { res } = await api('/api/test-utils/reset', { method: 'POST' });
  expect(res.ok, 'admin test reset').toBe(true);
});

extTest('X01: popup signup creates the account on the panel', async ({ popupPage: page }) => {
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_admin_url: 'http://localhost:3100' }));
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#adminConnStatus')).toContainText('Panel: http://localhost:3100');
  await page.locator('#btnShowSignup').click();
  await page.locator('#suName').fill('Ext User');
  await page.locator('#suEmail').fill('admin@tokentrim.local');
  await page.locator('#suPassword').fill('admin123');
  await page.locator('#suPin').fill('1234');
  await page.locator('#btnSignup').click();
  await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#authUserEmail')).toContainText('admin@tokentrim.local');
  await expect(page.locator('#authUserPlan')).toContainText('creator');

  const { res, data } = await api('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tokentrim.local', password: 'admin123' })
  });
  expect(res.ok).toBe(true);
  expect((data as { user: { id: string } }).user.id).toBeTruthy();
});

extTest('X02: extension conversion lands in the panel as a tracked event', async ({ popupPage: page }) => {
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_admin_url: 'http://localhost:3100' }));
  await page.locator('#settingsBtn').click();
  await page.locator('#btnShowSignup').click();
  await page.locator('#suEmail').fill('admin@tokentrim.local');
  await page.locator('#suPassword').fill('admin123');
  await page.locator('#suPin').fill('1234');
  await page.locator('#btnSignup').click();
  await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible({ timeout: 15000 });
  await page.locator('#saveSettingsBtn').click();

  await uploadAndWait(page, 'simple.pdf');
  await expect(page.locator('#markdownPreview')).toContainText('Hello TokenTrim');

  // The conversion event must be queryable on the panel, attributed to the user.
  const signin = await api('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tokentrim.local', password: 'admin123' })
  });
  const token = (signin.data as { token: string }).token;
  expect(token).toBeTruthy();

  // large.pdf actually saves tokens (simple.pdf is too tiny to save any)
  await uploadAndWait(page, 'large.pdf');
  await expect(page.locator('#markdownPreview')).toContainText('reference number');

  let found: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 10 && !found.length; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ev = await api('/api/admin/events?event=convert_success&limit=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(ev.res.ok).toBe(true);
    found = ((ev.data as { events: Array<Record<string, unknown>> }).events || [])
      .filter((e) => e.platform === 'extension');
  }
  expect(found.length).toBeGreaterThan(0);

  const users = await api('/api/admin/users?includeAdmins=true', { headers: { Authorization: `Bearer ${token}` } });
  const list = ((users.data as { users: Array<Record<string, unknown>> }).users || []);
  const me = list.find((u) => u.email === 'admin@tokentrim.local') as Record<string, unknown> | undefined;
  expect(me).toBeTruthy();
  expect(Number(me!.conversions)).toBeGreaterThanOrEqual(1);
  expect(Number(me!.tokensSaved)).toBeGreaterThan(0);
});

extTest('X03: popup forgot-password resets via the 4-digit key', async ({ popupPage: page }) => {
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_admin_url: 'http://localhost:3100' }));
  await page.locator('#settingsBtn').click();
  await page.locator('#btnShowSignup').click();
  await page.locator('#suEmail').fill('admin@tokentrim.local');
  await page.locator('#suPassword').fill('admin123');
  await page.locator('#suPin').fill('9999');
  await page.locator('#btnSignup').click();
  await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible({ timeout: 15000 });
  await page.locator('#btnSignOut').click();
  await expect(page.locator('#authSignedOut:not(.hidden)')).toBeVisible({ timeout: 10000 });

  await page.locator('#linkForgot').click();
  await page.locator('#fpEmail').fill('admin@tokentrim.local');
  await page.locator('#btnForgotNext').click();
  await expect(page.locator('#forgotStep2:not(.hidden)')).toBeVisible({ timeout: 10000 });
  await page.locator('#fpPin').fill('9999');
  await page.locator('#fpNewPassword').fill('Changed999');
  await page.locator('#btnResetPassword').click();
  await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#authUserEmail')).toContainText('admin@tokentrim.local');
});

extTest('X04: document sync API saves, lists, gets and deletes documents', async ({ popupPage: page }) => {
  await page.evaluate(() => chrome.storage.local.set({ tokentrim_admin_url: 'http://localhost:3100' }));
  await page.locator('#settingsBtn').click();
  await page.locator('#btnShowSignup').click();
  await page.locator('#suEmail').fill('admin@tokentrim.local');
  await page.locator('#suPassword').fill('admin123');
  await page.locator('#suPin').fill('1234');
  await page.locator('#btnSignup').click();
  await expect(page.locator('#authSignedIn:not(.hidden)')).toBeVisible({ timeout: 15000 });

  const signin = await api('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tokentrim.local', password: 'admin123' })
  });
  const token = (signin.data as { token: string }).token;
  expect(token).toBeTruthy();

  // POST document
  const saveRes = await api('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Cloud Doc Test',
      markdown: '# Test Cloud Markdown',
      preset: 'claude',
      chunks: ['# Test Cloud Markdown'],
      pages: 1,
      tokens: 25
    })
  });
  expect(saveRes.res.ok).toBe(true);
  const docId = (saveRes.data as { id: string }).id;
  expect(docId).toBeTruthy();

  // GET documents list
  const listRes = await api('/api/documents', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(listRes.res.ok).toBe(true);
  const docs = (listRes.data as { documents: Array<{ id: string; title: string }> }).documents;
  expect(docs.some(d => d.id === docId && d.title === 'Cloud Doc Test')).toBe(true);

  // GET single document
  const getRes = await api(`/api/documents/${encodeURIComponent(docId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(getRes.res.ok).toBe(true);
  expect((getRes.data as { document: { markdown: string } }).document.markdown).toContain('Test Cloud Markdown');

  // DELETE document
  const delRes = await api(`/api/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(delRes.res.ok).toBe(true);

  // Verify deleted
  const listAfter = await api('/api/documents', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const docsAfter = (listAfter.data as { documents: Array<{ id: string }> }).documents;
  expect(docsAfter.some(d => d.id === docId)).toBe(false);
});

