# AQUALITY backend

## Local setup

1. Ensure PostgreSQL is installed and running, then create the local database with `CREATE DATABASE aquality;` from `psql` or the VS Code PostgreSQL extension.
2. Copy `.env.example` to `.env`. Keep it private and set `DATABASE_URL=postgresql://username:password@localhost:5432/aquality`, a unique `JWT_SECRET` of at least 32 characters, `DATABASE_SSL=false`, and `HOST=0.0.0.0` for a phone on the same private LAN.
3. Install dependencies with `npm install`.
4. Run `npm run db:migrate` to create or advance the schema through migration 007. Applied files are recorded in `schema_migrations`.
5. Run `npm run db:seed` to validate the configured client calibration structure.
6. Start the API with `npm start`, then verify `GET http://localhost:4000/api/health` returns `database: "connected"`.

The Expo app reads `EXPO_PUBLIC_API_BASE_URL` from the root `.env` file. Use `http://localhost:4000/api` for web, `http://10.0.2.2:4000/api` for an Android emulator, or `http://<LAPTOP_LAN_IP>:4000/api` for a physical phone. Keep the phone and computer on the same private Wi-Fi and allow port 4000 through the Windows Firewall only on that private network if prompted. Verify reachability from the phone browser at `http://<LAPTOP_LAN_IP>:4000/api/health`.

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for environment, local PostgreSQL/VS Code connection values, migration, and release steps, and [`../docs/API.md`](../docs/API.md) for request/response contracts.

## Security model

- Registration, guest creation, and login return the existing public `user` response plus a short-lived bearer `token`.
- Every protected request verifies both the bearer token and that its PostgreSQL user still exists and is not archived. Old tokens immediately stop working after guest archival or permanent account deletion.
- Guest accounts are retained with their scans when they log out or pass `GUEST_ARCHIVE_DAYS` of inactivity. Archived guests cannot resume protected activity; registered users stay active until permanent deletion.
- Profile, water-test, upload, image, map, and account-deletion routes enforce bearer authentication and record ownership.
- Registered account deletion requires the current password. Account and scan deletion stage upload files safely around PostgreSQL transactions; a failed transaction restores files. A post-commit filesystem failure remains in the private pending-delete area for server-side cleanup rather than restoring a deleted account.
- Water-test images are private. The API returns a short-lived signed image URL in the existing `imageUri` and `imagePath` fields; uploads are not publicly served from `/uploads`.
- Logs intentionally exclude credentials, authorization headers, request bodies, and profile data.

## Color analysis and calibration limits
The active analysis path is image-based: pH uses sRGB/D65 Lab and CIEDE2000; Nitrite uses standard HSV degrees and provisional piecewise-linear ppm interpolation. The configurable normalized ROI falls back to the central 20% until physical pad coordinates are confirmed and reports `PAD LOCALIZATION REQUIRED`. Successful persistence is separate from scientific validation: `scanStatus` is `Completed`, values are `Estimated`, measured parameters remain `Not classified` without approved thresholds, and scientific validation remains `Pending laboratory validation`. Sharp performs Node-side decoding; no Python or ImageJ runtime is required. Neither parameter has experimental validation. See [`../CLIENT_SETUP.md`](../CLIENT_SETUP.md) for the client workflow and [`../docs/IMAGE_ANALYSIS.md`](../docs/IMAGE_ANALYSIS.md) for calibration and ROI details.

The supplied micromolar reference table is retained as metadata only and is not used for quantitative output.
