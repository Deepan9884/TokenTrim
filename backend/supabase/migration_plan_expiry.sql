-- TokenTrim Admin: Pro plan expiration (admin-granted, dated Pro)
-- Run once in Supabase SQL editor. Idempotent (IF NOT EXISTS / guarded).
-- The app falls back gracefully when this column is missing (grants land
-- as perpetual Pro), but dated expirations need this migration.

-- 1. profiles: when a Pro grant lapses (NULL = perpetual) -------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expiry ON profiles(plan_expires_at)
  WHERE plan = 'pro';

-- 2. Backfill: existing rows read as perpetual (NULL) — nothing to update. ----
-- 3. Optional: auto-downgrade view for reporting expired-but-flagged Pro -----
-- (The extension + /api/auth/me treat expired Pro as Free at read time;
--  uncomment the job below only if you want the stored plan flipped too.)

-- CREATE OR REPLACE FUNCTION downgrade_expired_pro()
-- RETURNS void AS $$
-- BEGIN
--   UPDATE profiles
--   SET plan = 'free', plan_expires_at = NULL
--   WHERE plan = 'pro'
--     AND plan_expires_at IS NOT NULL
--     AND plan_expires_at <= now();
-- END;
-- $$ LANGUAGE plpgsql;
--
-- SELECT cron.schedule('downgrade-expired-pro', '0 3 * * *', 'SELECT downgrade_expired_pro()');
