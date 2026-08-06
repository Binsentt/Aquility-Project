CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT,
  barangay TEXT,
  municipality TEXT,
  password_hash TEXT,
  account_type TEXT NOT NULL DEFAULT 'registered' CHECK (account_type IN ('registered', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registered_users_require_credentials CHECK (
    (account_type = 'guest' AND password_hash IS NULL) OR
    (account_type = 'registered' AND email IS NOT NULL AND password_hash IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS water_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  barangay TEXT,
  municipality TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  estimated_ph NUMERIC(4,2) NOT NULL,
  ph_status TEXT NOT NULL,
  estimated_nitrate NUMERIC(8,2) NOT NULL,
  nitrate_status TEXT NOT NULL,
  estimated_copper NUMERIC(8,3) NOT NULL,
  copper_status TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('Safe', 'Moderate', 'Unsafe')),
  remarks TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS water_tests_user_created_idx ON water_tests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS water_tests_coordinates_idx ON water_tests (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
