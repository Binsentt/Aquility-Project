# AQUALITY Turnover Package

This folder contains a sanitized handoff package for the AQUALITY project, limited to safe, non-production artifacts. It intentionally excludes production secrets, private database rows, and client-specific live credentials.

## Included

- `source/` — relevant application source directories used for the verified AQUALITY client and backend flow
- `database/` — schema migration files and the checked-in calibration metadata used in solution validation
- `setup.md` — local setup and validation guide without private credentials

The source snapshot includes its Expo manifests and app assets, and is synchronized with the review-branch implementation. New samples use classless `AQ-01`–`AQ-15` identifiers; no migration is needed because sample class/site/source fields are already nullable. Historical SA/A/SB records remain readable. The current production Railway API is pinned to commit `665c32db7b62de9eaeb0e82b053282fb780e5ae5`; workbook calibration source updates in this handoff require a separately approved backend deployment before they are active in production.

The client workbook and a structured extraction are included under `database/calibration_sources/` and `source/backend/database/calibration_sources/`. Individual pH 1–8 RGB samples are used with provisional per-channel RGB envelope, distance, and margin guards; pH 9–14 remains grouped without an individual numeric result. The Nitrite RGB observations have no ppm labels and are provenance-only. The package does not claim laboratory accuracy or physical-device acceptance. See `database/README.md` for the limits and handling notes.

## Safety restrictions

- No production database dumps or user records are included.
- No API tokens, JWT secrets, or credentials are stored here.
- Any environment or secret values must come from the repository's ignored local `.env` files or GitHub secrets only.
- Local `.env` files, uploads, dependency folders, and generated test logs are excluded from the source package.

## Verified scope

The project includes the React Native + Expo client, the Node.js backend, the PostgreSQL migration set (including the additive manual sample-location migration), and the scientific calibration data used by the analysis pipeline.
