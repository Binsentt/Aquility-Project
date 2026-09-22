# AQUILITY API

Base URL: `EXPO_PUBLIC_API_BASE_URL`, normally `https://api.example.com/api` in production.

Protected routes require `Authorization: Bearer <token>`. Errors use this additive shape:

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please sign in again.",
    "requestId": "optional-request-id"
  }
}
```

`401` means absent, invalid, expired, deleted, or inactive authentication. `403` means the caller is authenticated but does not own the requested resource. `ACCOUNT_ARCHIVED` is returned only after a correct registered-account password is supplied at login. Client errors use `400`, duplicate emails use `409`, database unavailability uses `503`, and uploads over 10 MB use `413`.

## Session and profile

| Method | Path | Authentication | Contract |
| --- | --- | --- | --- |
| POST | `/users` | No | Creates a registered user or guest. Returns `{ user, token }`. Registered users require `fullName`, valid `email`, and an 8-128 character password. |
| POST | `/auth/login` | No | Validates the stored bcrypt hash. Returns `{ user, token }`. |
| POST | `/auth/logout` | Owner | Archives the authenticated account only when it is a guest, then returns `204`. Registered users simply end their device session. |
| GET | `/users/:id` | Owner | Returns `{ user }` only when `:id` matches the token subject. |
| PUT | `/users/:id` | Owner | Updates public profile fields and returns `{ user }`. |
| DELETE | `/account` | Owner | Permanently deletes the authenticated account, cascade-owned water tests, and owned upload files. Registered users must send `{ "password": "current-password" }`; guests send no password. Returns `204`. |
| DELETE | `/users/:id` | Owner | Compatibility alias for current-account deletion only. `:id` must equal the token subject and it follows the same password-confirmation rules as `/account`. Returns `204`. |

There is intentionally no list-users endpoint in the production API.

## Water tests

| Method | Path | Authentication | Contract |
| --- | --- | --- | --- |
| POST | `/analyze-water` | Owner | Multipart field `image` plus `userId`, GPS, barangay, municipality, and ISO `capturedAt`. `userId` must equal the token subject. Stores the image and mock analysis; returns the existing result shape. |
| GET | `/water-tests?userId=:id` | Owner | Returns `{ items }`. The optional `userId` remains accepted for compatibility but must equal the token subject. |
| GET | `/water-tests/:id` | Owner | Returns a single existing result shape. |
| PUT | `/water-tests/:id` | Owner | Updates captured location/time metadata only. Stored chemical analysis remains immutable. |
| DELETE | `/water-tests/:id` | Owner | Permanently deletes one owned record and its associated upload file, then returns `204`. |
| GET | `/water-tests/:id/image?token=:signedToken` | Signed record URL | Streams the captured image only while its owner remains active. A bearer token for the owner is also accepted. Signed URLs expire after `MEDIA_TOKEN_TTL`. |

Water-test responses retain `id`, `imageUri`, `imagePath`, `pH`, `nitrate`, `overallStatus`, `gps`, `resultData`, and related fields used by existing screens. The API contract currently supports only the pH and nitrate analysis results, and the image fields contain a private signed API URL rather than a public upload path.

## Map feed

`GET /map-markers` requires a bearer token and returns an anonymous community marker list:

```json
{
  "items": [
    {
      "id": "water-test-uuid",
      "latitude": 14.6312,
      "longitude": 121.0731,
      "overallStatus": "Safe",
      "capturedAt": "2026-08-04T08:30:00.000Z",
      "barangay": "Bagumbayan",
      "municipality": "Quezon City"
    }
  ]
}
```

It never includes a user object, name, email, phone number, image URL, chemistry details, or credentials.

## Guest lifecycle

Guest rows are retained in PostgreSQL for scan-history association. They are archived, not deleted, at guest logout or when the scheduled cleanup finds `guest_expires_at`/`last_active_at` older than `GUEST_ARCHIVE_DAYS`. Archive fields are intentionally absent from public user responses. A guest may permanently delete the account before it is archived; after archival, its old bearer and signed-media tokens are denied.

## Mock-analysis replacement boundary

`backend/services/colorAnalysisEngine.js` loads the mock JSON fixture files under `backend/database/`. Replace that engine and fixture/reference data when validated calibration formulas are supplied. Preserve the /analyze-water response fields for pH and nitrate so the Expo client remains unchanged.
