ALTER TABLE water_tests
  ALTER COLUMN estimated_ph DROP NOT NULL,
  ALTER COLUMN estimated_nitrate DROP NOT NULL,
  ALTER COLUMN nitrate_status DROP NOT NULL;

ALTER TABLE water_tests
  ADD COLUMN IF NOT EXISTS estimated_nitrite NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS nitrite_status TEXT,
  ADD COLUMN IF NOT EXISTS analysis_data JSONB;

ALTER TABLE water_tests
  DROP CONSTRAINT IF EXISTS water_tests_overall_status_check;

ALTER TABLE water_tests
  ADD CONSTRAINT water_tests_overall_status_check
  CHECK (overall_status IN ('Safe', 'Moderate', 'Unsafe', 'Unvalidated'));