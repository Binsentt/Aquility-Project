# AQUILITY deployment checklist

## Environment

Create a private `backend/.env` from `backend/.env.example`. Never commit it or put real values in screenshots, documentation, or public messages.

Required production values:

- `NODE_ENV=production`
- `DATABASE_URL`: client-provided PostgreSQL connection string
- `JWT_SECRET`: unique random secret, at least 32 characters, kept only in the deployment secret manager
- `CORS_ORIGIN`: one or more comma-separated deployed app/web origins; do not use `*` in production
- `DATABASE_SSL=true` and, where required by the provider, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- `UPLOAD_DIR`: writable private volume. Plan a move to managed private object storage before large-scale production use.
- `GUEST_ARCHIVE_DAYS=30`: inactivity period before an active guest is archived.
- `GUEST_ARCHIVE_INTERVAL_MS=21600000`: server-side interval for the idempotent guest archive cleanup job.

The Expo root `.env` contains only the non-secret `EXPO_PUBLIC_API_BASE_URL`. It must point at the deployed `/api` URL reachable from Android devices. No database or JWT credential belongs in the mobile app.

## Database migration

1. Back up the target database.
2. Configure `DATABASE_URL` privately.
3. From `backend`, run `npm ci` and `npm run db:migrate`.
4. Confirm `schema_migrations` contains every numbered SQL file.
5. Run `npm run db:seed` only to validate the current mock fixtures; it does not replace production calibration data.

Migrations are transactional and recorded by filename. Production database changes are made solely by new numbered migration files--never by editing an already-applied migration.

For local VS Code PostgreSQL use, create the database first (for example `CREATE DATABASE aquility;`), copy `backend/.env.example` to the ignored `backend/.env`, set `DATABASE_URL=postgresql://username:password@localhost:5432/aquility`, then run the same migration and seed commands. Do not add the local `.env` file to source control.

## Backend startup

```powershell
cd backend
npm ci
npm run db:migrate
npm start
```

Place the service behind HTTPS. Set health monitoring to `GET /api/health`. Restrict database network access to the API service, retain application logs according to the client policy, and configure a writable non-public upload volume.

On startup, the API checks database connectivity before it begins listening. It returns `{ "status": "ok", "database": "connected" }` from health checks when PostgreSQL is reachable and safely reports an unavailable database otherwise. SIGINT/SIGTERM stop the guest archive timer, close the HTTP server, and close the PostgreSQL pool.

## Frontend configuration and build

1. Create root `.env` from `.env.example` and set the deployed API base URL.
2. Install with `npm ci`.
3. Run the test suite and `npx expo export --platform android --clear`.
4. Build through the client’s approved Expo/EAS Android release process.
5. On a physical device, register/login, capture and gallery-import a strip, allow/deny GPS, review History and Map, and export PDF/PNG.

Expo SecureStore keeps bearer tokens in device secure storage. AsyncStorage caches only the session-associated profile/history display data for temporary offline fallback; it is never the authoritative source and does not hold bearer tokens.

## Release acceptance

- [ ] Backend has a real private `.env`; root and backend `.gitignore` exclude `.env` files.
- [ ] Database migration and health check succeed against the client database.
- [ ] Login returns a token; invalid, expired, and cross-user requests return the documented errors.
- [ ] Registered account deletion requires the current password; guest logout archives the guest and old guest tokens are denied.
- [ ] Permanent account/scan deletion removes cascade-owned database records and their private uploads. Inspect and clean any private pending-delete files after an infrastructure-level post-commit filesystem failure.
- [ ] Captured images are accessible only through a fresh signed URL or owner bearer token.
- [ ] Map feed is anonymous and contains only marker fields.
- [ ] Scanner saves image, GPS/location, and result; History and owned detail reload from the API.
- [ ] PDF and PNG exports are created from a freshly fetched backend record.
- [ ] Android bundle succeeds and physical-device capture, GPS, sharing, and permissions have been checked.
- [ ] Real calibration formulas/reference data have been supplied and validated before any health claim is presented as laboratory-certified.

## Remaining client inputs

The client must supply the production `DATABASE_URL`, deployment host/TLS configuration, retention/privacy policy for captured images and GPS data, and validated pH/nitrate/copper calibration formulas with reference data. The current engine intentionally remains mock-only until those inputs arrive.
