-- Canonical study-site identity is nullable until verified site coordinates are supplied.
-- The existing latitude/longitude columns remain the device-captured GPS values.
ALTER TABLE water_tests
  ADD COLUMN IF NOT EXISTS sample_class TEXT,
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT;

CREATE INDEX IF NOT EXISTS water_tests_sample_site_idx
  ON water_tests (sample_class, site_name)
  WHERE sample_class IS NOT NULL;
