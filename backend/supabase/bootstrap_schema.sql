-- TokenTrim Admin: full bootstrap schema for a FRESH Supabase project.
-- Run once in Supabase SQL editor (postgres role). Fully idempotent:
-- every statement uses IF NOT EXISTS / OR REPLACE, so re-running is safe.
-- Covers every table the app touches: profiles, sessions, analytics_events,
-- user_documents, admin_audit_log — including plan_expires_at and all
-- single-browser security columns (no other migration needed afterwards).
--
-- NOTE: the app talks to Supabase with the SERVICE ROLE key, which bypasses
-- RLS, so no data policies are required. One read policy on the audit log is
-- included for admins using a normal client.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. profiles: accounts, plans, Pro expiry, security posture -----------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  password_hash TEXT,
  pin_hash TEXT,
  force_reauth BOOLEAN NOT NULL DEFAULT FALSE,
  current_device TEXT,
  current_ip TEXT,
  current_started_at TIMESTAMPTZ,
  failed_pin_attempts INT NOT NULL DEFAULT 0,
  last_failed_pin_at TIMESTAMPTZ,
  pin_locked_until TIMESTAMPTZ,
  -- legacy column kept for compatibility with older setups
  current_session_token_hash TEXT
);
-- Late additions for DBs created before these columns existed:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_device TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_ip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_reauth BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_pin_attempts INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_failed_pin_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_session_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expiry ON profiles(plan_expires_at)
  WHERE plan = 'pro';

-- 2. sessions: single-browser login tokens -----------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at);

-- 3. analytics_events: extension telemetry + security signals ----------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  session_id TEXT,
  client_version TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON analytics_events(event_name, created_at DESC);

-- 4. user_documents: cloud-synced conversions --------------------------------
CREATE TABLE IF NOT EXISTS user_documents (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'document',
  preset TEXT NOT NULL DEFAULT 'claude',
  markdown TEXT NOT NULL DEFAULT '',
  chunks JSONB NOT NULL DEFAULT '[]',
  pages INT NOT NULL DEFAULT 0,
  tokens INT NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'pdf',
  ocr_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_user_time ON user_documents(user_id, created_at DESC);

-- 5. admin_audit_log: every creator action -----------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- 6. single-browser enforcement helper (optional; app also enforces it) ------
CREATE OR REPLACE FUNCTION revoke_user_sessions(p_user_id UUID, p_reason TEXT DEFAULT 'new_login')
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  n INT := 0;
BEGIN
  UPDATE sessions
  SET revoked_at = now(), revoke_reason = p_reason
  WHERE user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE profiles
  SET force_reauth = (p_reason = 'admin_revoke'),
      current_device = CASE WHEN p_reason = 'admin_revoke' THEN NULL ELSE current_device END,
      current_ip = CASE WHEN p_reason = 'admin_revoke' THEN NULL ELSE current_ip END,
      current_started_at = CASE WHEN p_reason = 'admin_revoke' THEN NULL ELSE current_started_at END
  WHERE id = p_user_id;
  RETURN n;
END $$;

-- 7. audit-log read policy (service role bypasses RLS regardless) ------------
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read audit log" ON admin_audit_log;
CREATE POLICY "Admins can read audit log" ON admin_audit_log
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- 8. verify: expect 5 rows back ----------------------------------------------
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
