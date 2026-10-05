/**
 * TokenTrim Creator Panel E2E (admin Next.js app + extension connection).
 * Spawns its own admin server (`npm run dev`) with test endpoints enabled.
 * Plain web pages → headless is fine here.
 */
import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.ADMIN_BASE_URL || 'http://localhost:3100';

export default defineConfig({
  testDir: '.',
  testMatch: ['*.spec.ts'],
  globalSetup: './utils/global-setup.ts',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../test-results/admin-report' }]],
  outputDir: '../../test-results/admin-artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3100',
    cwd: '../../admin',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      ALLOW_TEST_ENDPOINTS: 'true'
    }
  }
});
