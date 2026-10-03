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

Water-test responses retain the API fields used by current screens, including `id`, `imageUri`, `pH`, `pHResult`, `nitrite`, `overallStatus`, `gps`, and `resultData`. Client result payloads include `scanStatus`, `measuredParametersStatus`, ROI status, GPS accuracy/time, and optional sample metadata; internal scientific-validation and lab-comparison columns are not included in client-facing responses. If a measured ROI has no supported reference match, the corresponding result is `No reference match` and the measured RGB plus reason is included in the result remarks; absent measurements remain `Unavailable`. When a finite measured pH exists, the display may add the conventional descriptive category `Acidic` for pH < 7, `Neutral` for pH = 7, or `Alkaline` for pH > 7; it is omitted for unavailable pH and is not a water-safety classification. Sample classes are `SA` (Pawikan), `A` (Well), and `SB` (Fish Farm). For compatibility, incoming `AA`/`AA-##` normalize to `SA`/`SA-##`, and `C`/`C-##` normalize to `SB`/`SB-##`; historical stored values are normalized at the serializer boundary without rewriting database rows. `pHResult` includes measured RGB/Lab, matched reference, and ΔE00; direct client pH RGB intervals 1–4 are independent of the separate Lab threshold. Active `nitrite` responses include the registered ROI median RGB, diagnostic HSV H/S/V, match state, matched reference metadata, and calibration metadata. The provisional classes are 0, 0.5, 1, and qualified `>1 ppm`; the qualified result retains `value: null`, `displayValue: ">1 ppm"`, `qualifier: ">"`, and `lowerBound: 1`. Ambiguous or out-of-reference colors return a null value; no interpolation or endpoint clamping is used. With no approved threshold set, `overallStatus` is `NOT CLASSIFIED` and measured parameters are `Not classified`. Historical Nitrate values remain stored for compatibility only and are not exposed as Nitrite. The image fields contain a private signed API URL rather than a public upload path.

## Map feed

`GET /map-markers` requires a bearer token and returns an anonymous community marker list:

The native Map and Full Map screens load the authenticated map feed first and use validated session-cached history only when the request fails. Marker IDs and finite latitude/longitude ranges are validated before display; invalid records are filtered, and personal user fields are never rendered. A denied location permission, unavailable GPS, malformed dates, or failed map-feed request leaves the screen usable. At the MapLibre boundary only, internal `{ latitude, longitude }` coordinates are converted to `[longitude, latitude]`.

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
      "municipality": "Quezon City",
      "pH": 7.25,
      "nitriteDisplay": ">1 ppm"
    }
  ]
}
```

It exposes only marker/location details and the saved pH number plus Nitrite display string. It never includes a user object, name, email, phone number, image URL, ROI/color diagnostics, full analysis metadata, or credentials. Missing measurements are represented as `pH: null` and/or `nitriteDisplay: "Unavailable"`; no Nitrite safety label is added because approved thresholds are not configured.

## Guest lifecycle

Guest rows are retained in PostgreSQL for scan-history association. They are archived, not deleted, at guest logout or when the scheduled cleanup finds `guest_expires_at`/`last_active_at` older than `GUEST_ARCHIVE_DAYS`. Archive fields are intentionally absent from public user responses. A guest may permanently delete the account before it is archived; after archival, its old bearer and signed-media tokens are denied.

## Image analysis and calibration boundary

`backend/services/colorAnalysisEngine.js` decodes the stored image using Sharp and registers the client µPAD through `backend/services/upadRegistration.js`. The detector requires the square Reference Point 1, triangle Reference Point 2, and two distinct detected circles in the authoritative order `square -> Nitrite -> pH -> triangle -> handle`. The circle nearest the square is Nitrite; the distinct circle nearest the triangle is pH. Template positions cannot synthesize missing circles. For each detected pad, a center ellipse limited to 68% of its detected radius defines the sampling mask; only pixels inside that inner ellipse are included in the robust ROI statistic. The detector derives translation, rotation, and scale from the anchors; strong perspective is rejected rather than silently corrected. A dark body contour is diagnostic and is not required when the two fiducials establish the frame. If a required fiducial or sensing circle is missing or invalid, `POST /analyze-water` returns HTTP 422 with `{ "error": { "code": "STRIP_REGISTRATION_FAILED", "message": "..." } }` and does not persist numeric results. Production has no center-crop fallback. pH uses sRGB-to-Lab D65 and CIEDE2000 against individual numeric Lab references; the client pH 1–4 RGB intervals are separately matched from the registered inner pH ROI, and a valid unambiguous direct RGB match does not require the Lab ΔE00 threshold. Legacy individual pH 5–9 Lab matching fails closed unless a provisional ΔE00 threshold is explicitly configured. pH 0 has no individual reference and remains unsupported; grouped `0-4` and `10-14` references are metadata only, are excluded from production matching, and are never API measurement values (legacy stored grouped results are serialized as unavailable). Active Nitrite uses only the client-provided direct RGB classes 0, 0.5, 1, and qualified `>1 ppm` from the registered Nitrite ROI. The `>1 ppm` result has no exact numeric value and is preserved in the `displayValue` field. HSV H/S/V are diagnostics only; the cited paper's saturation feature is not copied as a production equation. Historical Nitrate/Nitrite-equivalent metadata is compatibility-only. These software calculations do not establish accuracy, linearity, LOD, LOQ, precision, selectivity, or regression performance. Approved classification rules are intentionally absent until the client supplies them, so the API never invents Safe/Moderate/Unsafe. Current checked-in image QA is 4/4 registered, with pH and Nitrite unavailable on all four because their measured ROI colors are outside supported reference space; see [`IMAGE_ANALYSIS.md`](IMAGE_ANALYSIS.md) for the diagnostic RGB values.
