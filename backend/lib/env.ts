/**
 * Environment validation — fail closed in production.
 * Import for side effects from store/crypto entry points.
 */

function hasSupabasePair(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hasPartialSupabase(): boolean {
  return !!process.env.SUPABASE_URL !== !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function assertStoreEnv(): void {
  // Half-configured Supabase must never silently fall back to demo JSON.
  if (hasPartialSupabase()) {
    throw new Error(
      'Invalid store config: set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither (demo mode).'
    );
  }
  if (process.env.NODE_ENV === 'production' && !hasSupabasePair()) {
    // Production must use Postgres, never the local JSON file.
    throw new Error('Invalid store config: production requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  }
}

export function assertSecretsEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    const s = process.env.ADMIN_ACTION_SECRET || '';
    if (s.length < 32) {
      throw new Error('Invalid secrets config: ADMIN_ACTION_SECRET must be >= 32 chars in production.');
    }
    if (process.env.SEED_ADMIN !== 'false') {
      const pw = process.env.ADMIN_PASSWORD;
      if (!pw || pw === 'admin123') {
        throw new Error('Insecure config: ADMIN_PASSWORD must be explicitly set and cannot use default "admin123" in production.');
      }
      const pin = process.env.ADMIN_PIN;
      if (!pin || pin === '1234') {
        throw new Error('Insecure config: ADMIN_PIN must be explicitly set and cannot use default "1234" in production.');
      }
    }
  }
}

// Validate eagerly on import (server only) — except during `next build`
// page-data collection, where NODE_ENV=production is set but runtime env
// is not yet available. Runtime paths (getStore/actionSecret) re-validate.
const isNextBuild = !!process.env.NEXT_PHASE && process.env.NEXT_PHASE.includes('phase-production-build');
if (!isNextBuild) {
  try {
    assertStoreEnv();
    assertSecretsEnv();
  } catch (e) {
    // Throw at boot so misconfiguration is loud, not silent.
    throw e;
  }
}
