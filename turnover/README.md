# AQUALITY Turnover Package

This folder contains a sanitized handoff package for the AQUALITY project, limited to safe, non-production artifacts. It intentionally excludes production secrets, private database rows, and client-specific live credentials.

## Included

- `source/` — relevant application source directories used for the verified AQUALITY client and backend flow
- `database/` — schema migration files and the checked-in calibration metadata used in solution validation
- `setup.md` — local setup and validation guide without private credentials

The source snapshot includes its Expo manifests and app assets, and is synchronized with the review-branch implementation. New samples use classless `AQ-01`–`AQ-15` identifiers; no migration is needed because sample class/site/source fields are already nullable. Historical SA/A/SB records remain readable. The live Railway API still needs the reviewed backend update before an APK using AQ identifiers can submit scans.

## Safety restrictions

- No production database dumps or user records are included.
- No API tokens, JWT secrets, or credentials are stored here.
- Any environment or secret values must come from the repository's ignored local `.env` files or GitHub secrets only.
- Local `.env` files, uploads, dependency folders, and generated test logs are excluded from the source package.

## Verified scope

The project includes the React Native + Expo client, the Node.js backend, the PostgreSQL migration set (including the additive manual sample-location migration), and the scientific calibration data used by the analysis pipeline.
