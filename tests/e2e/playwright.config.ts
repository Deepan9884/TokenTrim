/**
 * TokenTrim Playwright config — live Chrome-extension E2E.
 *
 * Prerequisites: `npm run build` (loads unpacked extension from dist/).
 * Extension UI requires a real browser window: run headed locally
 * (`npm run test:e2e -- --headed` is default) or under xvfb on CI:
 *   xvfb-run -a npx playwright test
 *
 * Uses Playwright's bundled Chromium (no system Chrome required).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['*.spec.ts'],
  globalSetup: './utils/global-setup.ts',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../test-results/playwright-report' }]],
  outputDir: '../../test-results/playwright-artifacts',
  use: {
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
