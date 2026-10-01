# AQUALITY deployment checklist

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

The Expo root `.env` contains only the non-secret `EXPO_PUBLIC_API_BASE_URL` and optional `EXPO_PUBLIC_ALLOW_LOCAL_API` flag. The default and EAS value is `https://aquality-api-production.up.railway.app/api`; private localhost/LAN URLs are ignored unless the allow flag is explicitly `true`. No database or JWT credential belongs in the mobile app.

## Database migration

1. Back up the target database.
2. Configure `DATABASE_URL` privately.
3. From `backend`, run `npm ci` and `npm run db:migrate`.
4. Confirm `schema_migrations` contains every numbered SQL file.
5. Run `npm run db:seed` to validate the checked-in client calibration structure; it does not insert sample accounts or water-test rows and does not establish scientific validity.

Migrations are transactional and recorded by filename. Production database changes are made solely by new numbered migration files--never by editing an already-applied migration.
The current schema includes `007_add_scientific_sample_metadata.sql` for optional sample codes, GPS accuracy/capture time, canonical-site coordinates, status separation, and nullable lab comparison values.

For local development through PostgreSQL or the VS Code PostgreSQL extension, use these values without placing the password in documentation:

- Host: `localhost`
- Port: `5432`
- Database: `aquality`
- Username: your local PostgreSQL username
- Password: your local PostgreSQL password (private)
- SSL: `false`

Create the database with `CREATE DATABASE aquality;`, copy `backend/.env.example` to the ignored `backend/.env`, set `DATABASE_URL=postgresql://username:password@localhost:5432/aquality`, and run `npm run db:migrate` followed by `npm run db:seed` from `backend`. Do not add the local `.env` file to source control.

## Backend startup

```powershell
cd backend
npm ci
npm run db:migrate
npm start
```

Place the service behind HTTPS. Set health monitoring to `GET /api/health`. For Railway's single reverse-proxy hop, set the non-secret `TRUST_PROXY_HOPS=1`; local development should use `TRUST_PROXY_HOPS=0`. Restrict database network access to the API service, retain application logs according to the client policy, and configure a writable non-public upload volume.

On startup, the API checks database connectivity before it begins listening. It returns `{ "status": "ok", "database": "connected" }` from health checks when PostgreSQL is reachable and safely reports an unavailable database otherwise. SIGINT/SIGTERM stop the guest archive timer, close the HTTP server, and close the PostgreSQL pool.

In development the server binds to `0.0.0.0:4000` by default so Expo Go on a phone can reach it over the LAN. Production defaults to loopback unless `HOST` is explicitly configured. Do not weaken Windows Firewall globally; allow port 4000 only on a private network when needed.

## Frontend configuration and build

1. Create root `.env` from `.env.example`; it already defaults to the deployed Railway API. Set `EXPO_PUBLIC_ALLOW_LOCAL_API=true` only for an intentional local/LAN backend run.
2. Install with `npm ci`.
3. Run the test suite and `npx expo export --platform android --clear`.
4. Build through the client’s approved Expo/EAS Android release process.
5. On a physical device, register/login, capture and gallery-import a strip, allow/deny GPS, review History and Map, and export PDF/PNG.

Expo SecureStore keeps bearer tokens in device secure storage. AsyncStorage caches only the session-associated profile/history display data for temporary offline fallback; it is never the authoritative source and does not hold bearer tokens.

For intentional local Expo Go testing on a physical Android or iOS device,
determine the computer's private LAN IPv4 address with `ipconfig` and set both
`EXPO_PUBLIC_ALLOW_LOCAL_API=true` and
`EXPO_PUBLIC_API_BASE_URL=http://<LAPTOP_LAN_IP>:4000/api` in the root `.env`
before starting Expo. Without the explicit flag, the Railway API remains the
selected endpoint. Start Metro with:

```powershell
npx expo start --lan --clear
```

The backend and phone must be on the same Wi-Fi. The Expo Go QR/deep link must
use a reachable LAN host, never `exp://127.0.0.1:8081`. If
`/api/health` does not open in the phone browser, check the server process,
address, port, Windows Firewall permission for private networks, and Wi-Fi
client isolation. Tunnel mode is an alternative when LAN access is unavailable:

```powershell
npx expo start --tunnel --clear
```

`EXPO_PUBLIC_*` values are client-visible. They may contain the non-secret API
URL only; never put `DATABASE_URL`, PostgreSQL credentials, or `JWT_SECRET` in
the Expo root environment.

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

The client must supply the production `DATABASE_URL`, deployment host/TLS configuration, retention/privacy policy for captured images and GPS data, confirm that supplied Nitrite hue values use standard HSV degrees, and provide experimental validation before relying on analytical performance. The active engine performs image-based pH and provisional Nitrite analysis; it is not mock-only and does not claim scientific validation.

For local client installation and daily startup commands, see [`../CLIENT_SETUP.md`](../CLIENT_SETUP.md). For the implemented image pipeline and normalized ROI configuration, see [`IMAGE_ANALYSIS.md`](IMAGE_ANALYSIS.md).
