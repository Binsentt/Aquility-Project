# AQUALITY Database Turnover

This folder contains the safe schema artifacts used to build or validate the project database.

## Included

- migrations: PostgreSQL migration scripts from the server-side repo state
- calibration JSON: safe calibration metadata used by the analysis pipeline
- `calibration_sources/`: the unchanged client workbook and a source-hashed structured extraction; Nitrite RGBs remain unlabeled and are not calibration ppm values
- migration `008_add_manual_sample_location.sql`: additive nullable sample coordinates, stored independently from device GPS

## Notes

- This package intentionally excludes user data, production records, and any private credentials.
- Apply migrations in order using the database migration runner from `backend/database/migrate.js`.
- The health endpoint advertises manual sample-location support only when both new coordinate columns are present.
- Migration 008 does not rewrite existing GPS values or include database records.
- Workbook pH references are provisional and guarded by per-class RGB envelope, distance, and margin checks; the workbook does not establish independent laboratory or camera accuracy. Its pH 9–14 class is grouped, and its Nitrite samples have no ppm labels.
- Source details, the within-workbook holdout summary, and the low-saturation limitation are documented in [`../../docs/WORKBOOK_CALIBRATION.md`](../../docs/WORKBOOK_CALIBRATION.md).
