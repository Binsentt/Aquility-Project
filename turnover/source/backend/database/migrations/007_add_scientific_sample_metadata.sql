-- Scientific/sample metadata is additive and idempotent. Historical migrations remain unchanged.
ALTER TABLE water_tests
  ADD COLUMN IF NOT EXISTS sample_code TEXT,
  ADD COLUMN IF NOT EXISTS sample_number INTEGER,
  ADD COLUMN IF NOT EXISTS gps_accuracy_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canonical_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS canonical_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS measured_parameters_status TEXT,
  ADD COLUMN IF NOT EXISTS scientific_validation_status TEXT,
  ADD COLUMN IF NOT EXISTS lab_ph NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS lab_nitrite NUMERIC(8,2);

ALTER TABLE water_tests
  DROP CONSTRAINT IF EXISTS water_tests_overall_status_check;

ALTER TABLE water_tests
  ADD CONSTRAINT water_tests_overall_status_check
  CHECK (overall_status IN ('Safe', 'Moderate', 'Unsafe', 'Unvalidated', 'NOT CLASSIFIED'));

CREATE INDEX IF NOT EXISTS water_tests_sample_code_idx ON water_tests (sample_code)
  WHERE sample_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS water_tests_gps_captured_idx ON water_tests (gps_captured_at DESC)
  WHERE gps_captured_at IS NOT NULL;
