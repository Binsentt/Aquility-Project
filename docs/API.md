# AQUALITY API

Base URL: `EXPO_PUBLIC_API_BASE_URL`, defaulting to `https://aquality-api-production.up.railway.app/api`. Local or LAN URLs require `EXPO_PUBLIC_ALLOW_LOCAL_API=true`.

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
| POST | `/analyze-water` | Owner | Multipart field `image` plus `userId`, GPS, GPS accuracy/capture time, optional sample code, barangay, municipality, and ISO `capturedAt`. `userId` must equal the token subject. Stores the original image and pH + Nitrite analysis. |
| GET | `/water-tests?userId=:id` | Owner | Returns `{ items }`. The optional `userId` remains accepted for compatibility but must equal the token subject. |
| GET | `/water-tests/:id` | Owner | Returns a single existing result shape. |
| PUT | `/water-tests/:id` | Owner | Updates captured location/time metadata only. Stored chemical analysis remains immutable. |
| DELETE | `/water-tests/:id` | Owner | Permanently deletes one owned record and its associated upload file, then returns `204`. |
| GET | `/water-tests/:id/image?token=:signedToken` | Signed record URL | Streams the captured image only while its owner remains active. A bearer token for the owner is also accepted. Signed URLs expire after `MEDIA_TOKEN_TTL`. |

Water-test responses retain `id`, `imageUri`, `imagePath`, `pH`, `pHResult`, `nitrite`, `overallStatus`, `gps`, `resultData`, and related fields used by existing screens. They additionally expose `scanStatus`, `measuredParametersStatus`, `scientificValidationStatus`, `roiLocalizationStatus`, GPS accuracy/time, optional sample code/site metadata, and nullable `labComparison` values. `pHResult` includes measured RGB/Lab, matched reference, and ΔE00; grouped references such as `0-4` and `10-14` return range labels with no invented exact value. Active `nitrite` responses include the registered ROI median RGB, diagnostic HSV H/S/V, `matchState`, `matchingMethod: direct-client-rgb-range`, matched reference metadata, and calibration metadata. The only active provisional classes are 0, 0.5, and 1 ppm. Ambiguous or out-of-reference colors return a null value with `NITRITE_MEASUREMENT_UNRELIABLE` or `NITRITE_OUTSIDE_CALIBRATION_RANGE`; no interpolation or endpoint clamping is used. With no approved threshold set, `overallStatus` is `NOT CLASSIFIED`, measured parameters are `Not classified`, and scientific validation is `Pending laboratory validation`; these are not laboratory or water-safety claims. Historical Nitrate values remain stored for compatibility only and are not exposed as Nitrite. The image fields contain a private signed API URL rather than a public upload path.

## Map feed

`GET /map-markers` requires a bearer token and returns an anonymous community marker list:

The native screens validate marker IDs, finite latitude/longitude ranges, and dates before passing data to `react-native-maps`. Invalid markers, denied location permission, unavailable GPS, malformed dates, and failed map-feed requests resolve to a recoverable empty/cached state; they are never passed directly to a native `Marker`.

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

## Image analysis and calibration boundary

`backend/services/colorAnalysisEngine.js` decodes the stored image using Sharp and registers the client µPAD schematic through `backend/services/upadRegistration.js`. The detector requires the square Reference Point 1, triangle Reference Point 2, and two distinct circles in the authoritative order `square -> Nitrite -> pH -> triangle`. The client physical model is 50 mm × 10 mm with 2.5 mm square/triangle references, 5 mm sensing circles, 2.625 mm outer-reference spacing, and 5 mm circle spacing; the edge-versus-center convention remains ambiguous and is not guessed. The detector derives translation, rotation, and scale from the anchors and returns separate template-relative circle ROIs; strong perspective is rejected rather than silently corrected. If the body, reference marks, or either zone is missing or invalid, `POST /analyze-water` returns HTTP 422 with `{ "error": { "code": "STRIP_REGISTRATION_FAILED", "message": "..." } }` and does not persist numeric results. The legacy fallback remains marked for isolated developer fixtures only. pH uses sRGB-to-Lab D65 and CIEDE2000 against the supplied Lab references; the newly supplied pH 1–4 RGB intervals are matched from the registered median pH ROI as provisional exact/near-range values, with ambiguity and poor CIEDE2000 matches rejected. pH 0 has no individual reference and remains unsupported; grouped `0-4` and `10-14` references remain ranges. Active Nitrite uses only the client-provided direct RGB classes 0, 0.5, and 1 ppm from the registered left Nitrite ROI, with exact/in-range, near, ambiguous, and outside-reference states. HSV H/S/V are diagnostics only; the cited paper's saturation feature is not copied as a production equation. Historical Nitrate/Nitrite-equivalent metadata is compatibility-only. These software calculations do not establish accuracy, linearity, LOD, LOQ, precision, selectivity, or regression performance. Approved classification rules are intentionally absent until the client supplies them, so the API never invents Safe/Moderate/Unsafe.
