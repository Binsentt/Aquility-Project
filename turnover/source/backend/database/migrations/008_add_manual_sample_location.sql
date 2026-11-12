-- Manual testing coordinates are separate from device GPS; existing GPS values are never reclassified.
ALTER TABLE water_tests
  ADD COLUMN IF NOT EXISTS manual_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS manual_longitude DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'water_tests_manual_location_check'
      AND conrelid = 'water_tests'::regclass
  ) THEN
    ALTER TABLE water_tests
      ADD CONSTRAINT water_tests_manual_location_check
      CHECK (
        (manual_latitude IS NULL AND manual_longitude IS NULL)
        OR (
          manual_latitude BETWEEN -90 AND 90
          AND manual_longitude BETWEEN -180 AND 180
        )
      );
  END IF;
END
$$;
