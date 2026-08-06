ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS users_active_account_idx
  ON users (account_type, last_active_at DESC)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS users_guest_expiry_idx
  ON users (guest_expires_at)
  WHERE account_type = 'guest' AND is_archived = FALSE AND guest_expires_at IS NOT NULL;
