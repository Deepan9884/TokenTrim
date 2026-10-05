/** Shared helpers for admin-panel specs (web UI, headless-safe). */
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

async function api(path: string, init?: RequestInit) {
  const base = process.env.ADMIN_BASE_URL || 'http://localhost:3100';
  const res = await fetch(base + path, init);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function apiReset() {
  const { res } = await api('/api/test-utils/reset', { method: 'POST' });
  expect(res.ok, 'test reset endpoint').toBe(true);
}

export async function apiSeed(): Promise<{ users: number; events: number }> {
  const { res, data } = await api('/api/test-utils/seed', { method: 'POST' });
  expect(res.ok, 'test seed endpoint').toBe(true);
  return data as { users: number; events: number };
}

export async function apiSignup(email: string, password: string, pin: string, name = '') {
  const { res, data } = await api('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, pin, name })
  });
  expect(res.ok, `signup ${email}`).toBe(true);
  return data as { user: { id: string; email: string }; token: string };
}

export async function apiSignin(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; is_admin: boolean } }> {
  const { res, data } = await api('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  expect(res.ok, `signin ${email}`).toBe(true);
  return data as { token: string; user: { id: string; email: string; is_admin: boolean } };
}

export async function apiAuthed(path: string, token: string) {
  const base = process.env.ADMIN_BASE_URL || 'http://localhost:3100';
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** UI login as an existing account; lands on /dashboard. */
export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

export const test = base;
