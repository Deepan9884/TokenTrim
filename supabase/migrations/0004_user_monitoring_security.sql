-- TokenTrim Admin: user monitoring + single-browser security
-- Run once in Supabase SQL editor. Idempotent (IF NOT EXISTS / guarded).
-- The app gracefully falls back when these columns/tables are missing,
-- but full single-session + audit functionality needs this migration.

-- 1. profiles: live-session pointer + lockout + force re-auth ---------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_session_token_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_device TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_ip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_reauth BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_pin_attempts INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_failed_pin_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- 2. sessions: device/ip + soft revoke (keeps audit trail) -------------------
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at);

-- 3. creator audit log --------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- 4. single-browser enforcement helper (optional; app also enforces it) ------
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

-- 5. row-level security for the audit log ------------------------------------
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read audit log" ON admin_audit_log;
CREATE POLICY "Admins can read audit log" ON admin_audit_log
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = TRUE)
  );

-- 6. analytics index for the monitoring queries ------------------------------
CREATE INDEX IF NOT EXISTS idx_events_user_time ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON analytics_events(event_name, created_at DESC);
