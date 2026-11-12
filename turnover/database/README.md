# AQUALITY Database Turnover

This folder contains the safe schema artifacts used to build or validate the project database.

## Included

- migrations: PostgreSQL migration scripts from the server-side repo state
- calibration JSON: safe calibration metadata used by the analysis pipeline

## Notes

- This package intentionally excludes user data, production records, and any private credentials.
- Apply migrations in order using the database migration runner from `backend/database/migrate.js`.
