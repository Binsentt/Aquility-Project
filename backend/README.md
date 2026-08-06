# AQUILITY backend

## Local setup

1. Create a local database, for example `CREATE DATABASE aquility;` from PostgreSQL `psql` or your VS Code PostgreSQL extension.
2. Copy `.env.example` to `.env`. Keep it private and set a local value such as `DATABASE_URL=postgresql://username:password@localhost:5432/aquility`, plus a unique `JWT_SECRET` of at least 32 characters.
3. Install dependencies with `npm install`.
4. Run `npm run db:migrate` to create or advance the schema. Applied files are recorded in `schema_migrations`.
5. Run `npm run db:seed` to validate the replaceable mock fixtures.
6. Start the API with `npm start`, then verify `GET http://localhost:4000/api/health` returns `database: "connected"`.

The Expo app reads `EXPO_PUBLIC_API_BASE_URL` from the root `.env` file. For an Android emulator, use `http://10.0.2.2:4000/api`; a physical device needs a reachable HTTPS or LAN URL.

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for environment, migration, and release steps, and [`../docs/API.md`](../docs/API.md) for request/response contracts.

## Security model

- Registration, guest creation, and login return the existing public `user` response plus a short-lived bearer `token`.
- Every protected request verifies both the bearer token and that its PostgreSQL user still exists and is not archived. Old tokens immediately stop working after guest archival or permanent account deletion.
- Guest accounts are retained with their scans when they log out or pass `GUEST_ARCHIVE_DAYS` of inactivity. Archived guests cannot resume protected activity; registered users stay active until permanent deletion.
- Profile, water-test, upload, image, map, and account-deletion routes enforce bearer authentication and record ownership.
- Registered account deletion requires the current password. Account and scan deletion stage upload files safely around PostgreSQL transactions; a failed transaction restores files. A post-commit filesystem failure remains in the private pending-delete area for server-side cleanup rather than restoring a deleted account.
- Water-test images are private. The API returns a short-lived signed image URL in the existing `imageUri` and `imagePath` fields; uploads are not publicly served from `/uploads`.
- Logs intentionally exclude credentials, authorization headers, request bodies, and profile data.

## Replaceable mock analysis

`database/mockCalibration.json`, `database/mockColorReference.json`, and `database/mockWaterSamples.json` are deliberately read by `services/colorAnalysisEngine.js`. Replace those data files and the engine implementation when calibrated strip formulas become available. Keep the `/api/analyze-water` response contract unchanged so mobile screens do not need to change.
