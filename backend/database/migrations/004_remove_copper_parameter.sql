-- Remove the retired copper parameter after the active app contract switched to pH + nitrate only.
-- This migration is intentionally additive and safe for already-applied databases.
ALTER TABLE IF EXISTS water_tests DROP COLUMN IF EXISTS estimated_copper;
ALTER TABLE IF EXISTS water_tests DROP COLUMN IF EXISTS copper_status;
