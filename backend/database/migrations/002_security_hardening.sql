ALTER TABLE water_tests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS water_tests_map_created_idx
  ON water_tests (created_at DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
