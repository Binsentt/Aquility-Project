# AQUILITY API Security Hardening Design

## Goal

Protect AQUILITY user data, water-test records, and captured images with short-lived bearer tokens while keeping the existing Expo navigation, screen structure, API result fields, and mock-analysis contract intact.

## Decisions

- A successful registered-user login, registration, or guest-profile creation returns the existing `user` object plus an additive `token` field.
- The backend signs short-lived JWT bearer tokens with `JWT_SECRET`. The Expo client stores only this token in Expo SecureStore; AsyncStorage continues to cache only the already-public session/profile/history screen shapes for offline fallback.
- The shared API client attaches `Authorization: Bearer <token>` by default. A `401` from a protected request clears the secure token and cached session so the existing navigation returns to the login flow.
- Personal routes require the authenticated user to own the requested profile or water-test record. The supplied `userId` remains accepted where it already exists for compatibility, but it must equal the token subject.
- Captured files are no longer served from a public upload directory. Detail/list responses retain `imageUri` and `imagePath`, but populate them with a short-lived, record-bound signed media URL. Changing the record ID invalidates the signature. Server-side ownership checks still apply to bearer-authenticated image requests.
- `GET /api/map-markers` requires authentication and returns only `id`, GPS coordinates, overall status, capture date, barangay, and municipality. It does not join or serialize user, contact, credential, image, or result-detail data.
- Water-test result values are immutable analysis output. The additive update operation permits only capture-location metadata for a record owned by the caller; it never lets the client overwrite the stored chemical analysis.
- The mock analysis engine remains isolated in `services/colorAnalysisEngine.js` and its three JSON fixtures. Its input/output contract is unchanged.

## Server Architecture

`authTokenService` owns JWT issue/verification and signed image URLs. `authMiddleware` converts valid bearer tokens into `req.auth`; authorization helpers compare that subject with the path/query/body ownership target. Controllers validate input before calling services. Services enforce ownership again before models run queries.

The app adds request IDs, structured non-sensitive request/error logging, stricter CORS configuration, secure response headers, rate limits for login and analysis, explicit Postgres pool timeouts, migration tracking, and database error translation. Logs include request metadata and error codes only--never headers, request bodies, passwords, tokens, images, or profile data.

## Client Architecture

`authTokenStore` is the sole SecureStore boundary. `apiClient` maintains the in-memory token, adds it to requests, and notifies `AuthContext` about authorization loss. `AuthContext` persists/clears the token alongside its existing backend-first session lifecycle. Results and History refresh a record from the API before export so report data and signed image URLs come from the backend. The native Map screens load their own marker feed from the backend rather than deriving it from `scanHistory`.

## Compatibility

Existing route paths, navigation destinations, result fields (`id`, `imageUri`, `imagePath`, `pH`, `nitrate`, `copper`, `overallStatus`, `gps`, `resultData`) and UI workflow remain. `token` and the map-feed route are additive. Calls lacking authorization now receive the documented `401`/`403` errors rather than access to another account's data.

## Non-goals

- No Expo SDK upgrade, design refresh, navigation rewrite, calibration formula change, or production database credential is part of this pass.
- JWT revocation/refresh-token rotation and object-storage/CDN integration remain production follow-up items; access tokens expire promptly and media URLs have a shorter expiry.
