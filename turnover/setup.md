# AQUALITY Setup Guide

This guide is intentionally limited to safe local setup steps. It excludes private credentials and production data.

## 1. Prerequisites

- Node.js LTS
- PostgreSQL 14+ running locally
- Git
- Optional: Expo Go for physical-device testing

## 2. Configure PostgreSQL

Create a private local database and user, then keep the credentials only in the ignored backend `.env` file.

```sql
CREATE USER aquality_user WITH PASSWORD 'choose-a-private-password';
CREATE DATABASE aquality OWNER aquality_user;
```

## 3. Install dependencies

```powershell
npm install
Set-Location backend
npm install
```

## 4. Configure environment

Create the ignored backend environment file locally:

```powershell
Copy-Item backend/.env.example backend/.env
```

Then set `DATABASE_URL`, `JWT_SECRET`, and the local server settings in `backend/.env`. Never commit these values.

## 5. Apply migrations

```powershell
Set-Location backend
npm run db:migrate
npm run db:seed
```

The seed script validates the checked-in calibration JSON but should not be used to load production records.

Manual sample pins use the additive migration `008_add_manual_sample_location.sql`, stored separately from actual GPS fields. After applying migrations, `/api/health` reports `features.manualSampleLocation: true` when both manual coordinate columns are available. The client will not upload a manually pinned scan when this capability is absent; no production deployment or private database export is part of this package.

## 6. Start the app

Terminal 1:

```powershell
Set-Location backend
npm start
```

Terminal 2:

```powershell
npm run web
```

For Expo Go on a phone, use the root `.env` example and point `EXPO_PUBLIC_API_BASE_URL` to the computer's LAN IPv4 address, not `127.0.0.1`.

## 7. Validate

- confirm `/api/health` returns a database-connected status and `features.manualSampleLocation: true` after migration 008
- log in or register an authorized test account
- run an image analysis and check results/history export
- verify PDF and image export still work
- ensure GPS/manual pin selection remains optional
