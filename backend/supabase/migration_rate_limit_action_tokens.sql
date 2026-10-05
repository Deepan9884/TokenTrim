-- TokenTrim: cross-instance rate limiting + admin action replay protection
-- Run once in Supabase SQL editor. Idempotent. App works without these
-- tables (in-memory fallback), but multi-instance deployments need them.

-- 1. Rate-limit hits (append-only, short-lived) ---------------------------
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket TEXT NOT NULL,
  window_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ratelimit_bucket_time ON rate_limit_hits(bucket, created_at DESC);

-- Retain only 24h; run periodically (pg_cron or manual DELETE).
-- DELETE FROM rate_limit_hits WHERE created_at < now() - INTERVAL '24 hours';

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Deny direct client access; API uses the service role (bypasses RLS).
DROP POLICY IF EXISTS "deny_all_rate_limit" ON rate_limit_hits;

-- 2. Consumed admin action tokens (replay protection) ---------------------
CREATE TABLE IF NOT EXISTS admin_action_tokens (
  jti TEXT PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_action_tokens_expires ON admin_action_tokens(expires_at);

-- Retain only expired+1h; run periodically.
-- DELETE FROM admin_action_tokens WHERE expires_at < now() - INTERVAL '1 hour';

ALTER TABLE admin_action_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_action_tokens" ON admin_action_tokens;
