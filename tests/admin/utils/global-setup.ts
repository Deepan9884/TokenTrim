/** Fail fast if the admin server isn't healthy; start from a clean demo DB. */

async function globalSetup() {
  const base = process.env.ADMIN_BASE_URL || 'http://localhost:3100';
  const health = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Admin server not healthy at ${base} — is webServer running?`);
  }
  const reset = await fetch(`${base}/api/test-utils/reset`, { method: 'POST' });
  if (!reset.ok) {
    throw new Error('Test endpoints unavailable — start the server with ALLOW_TEST_ENDPOINTS=true.');
  }
  console.log(`[admin-e2e] server ok (store=${health.store}), demo DB reset`);
}

export default globalSetup;
