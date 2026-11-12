# AQUALITY Database Turnover

This folder contains the safe schema artifacts used to build or validate the project database.

## Included

- migrations: PostgreSQL migration scripts from the server-side repo state
- calibration JSON: safe calibration metadata used by the analysis pipeline
- migration `008_add_manual_sample_location.sql`: additive nullable sample coordinates, stored independently from device GPS

## Notes

- This package intentionally excludes user data, production records, and any private credentials.
- Apply migrations in order using the database migration runner from `backend/database/migrate.js`.
- The health endpoint advertises manual sample-location support only when both new coordinate columns are present.
- Migration 008 does not rewrite existing GPS values or include database records.
