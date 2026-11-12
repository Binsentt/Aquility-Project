# AQUALITY Turnover Package

This folder contains a sanitized handoff package for the AQUALITY project, limited to safe, non-production artifacts. It intentionally excludes production secrets, private database rows, and client-specific live credentials.

## Included

- `source/` — relevant application source directories used for the verified AQUALITY client and backend flow
- `database/` — schema migration files and the checked-in calibration metadata used in solution validation
- `setup.md` — local setup and validation guide without private credentials

## Safety restrictions

- No production database dumps or user records are included.
- No API tokens, JWT secrets, or credentials are stored here.
- Any environment or secret values must come from the repository's ignored local `.env` files or GitHub secrets only.

## Verified scope

The project includes the React Native + Expo client, the Node.js backend, the PostgreSQL migration set, and the scientific calibration data used by the analysis pipeline.
