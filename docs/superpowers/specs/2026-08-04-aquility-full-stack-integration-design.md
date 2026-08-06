# AQUILITY full-stack integration design

## Goal

Add a Node.js/Express service and PostgreSQL-ready persistence to the existing Expo application without changing its navigation or visual structure. User profiles, water-test records, map data, and report data become backend-owned. AsyncStorage remains only for restoring a session and showing a cached profile/history when the API is temporarily unavailable.

## Architecture

The Expo app remains in the existing project root. A sibling `backend/` directory contains an Express service organised as `config`, `database`, `models`, `routes`, `controllers`, `services`, `middleware`, `utils`, and `uploads`.

The server uses a PostgreSQL `Pool` configured through `DATABASE_URL` or individual database environment variables. SQL migrations define the schema and a seed command imports replaceable testing JSON. Uploaded captured-strip images are stored under `backend/uploads` and delivered only through an owned or short-lived signed water-test image route. The app uses `EXPO_PUBLIC_API_BASE_URL` and a single API client so no screen embeds URLs or analysis values.

## Data model

`users` holds an ID, full name, nullable unique email, phone number, barangay, municipality, password hash where applicable, timestamps, and account type. Credentials are accepted only by registration/login endpoints, stored with a bcrypt hash, and omitted from every API response.

`water_tests` holds an ID, user ID, image path, latitude, longitude, barangay, municipality, captured time, estimated pH, nitrate and copper values and statuses, overall status, remarks, and timestamps. A foreign key links each test to its user; indexes support user history and map queries.

## API contract

User endpoints support `POST /api/users`, `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, and `DELETE /api/users/:id`. Registration and guest entry call user creation; profile edits call user update. `POST /api/auth/login` validates an email/password credential and returns the public user profile.

`POST /api/analyze-water` accepts multipart form data: `image`, `userId`, `gpsLatitude`, `gpsLongitude`, `barangay`, `municipality`, and `capturedAt`. It stores the upload and one backend-owned test record, then returns the test ID, pH, nitrate, copper, overall status, remarks, coordinates, and analysis time. `GET /api/water-tests`, `GET /api/water-tests/:id`, and `DELETE /api/water-tests/:id` expose history. List responses include the public user information needed for map and reporting views.

## Mock analysis boundary

`colorAnalysisEngine` reads `mockCalibration.json`, `mockColorReference.json`, and `mockWaterSamples.json`. `waterAnalysisService` maps that output to the stable API response. Neither Expo screens nor controllers implement color formulas. Replacing the mock engine and JSON fixtures with calibrated RGB/HSV/LAB analysis leaves the HTTP contract and screens unchanged.

## Frontend migration

The existing `AuthContext` remains the public state boundary. It hydrates a cached session, refreshes user and test data from the API, and caches successful responses for offline reading. Its registration, guest, login, profile, history, and deletion functions become asynchronous API operations.

Camera/gallery capture sends its image and current user/location metadata to the analysis endpoint. Results and History render the normalized backend record. Native map markers derive green, amber, or red from the backend overall status; selecting one uses the existing result navigation. The web map keeps its deliberate fallback screen.

The existing PDF service receives the public user and water-test record and renders profile details, captured image, results, GPS/location, status, and remarks. Calls that use legacy file-system methods import `expo-file-system/legacy`; modern APIs are not substituted into those flows.

## Errors and verification

The server returns structured validation, not-found, upload, database, and internal errors. The app shows the existing screen-level feedback and uses cache only when a network request fails; successful API responses always replace the cache.

Backend tests cover validation, credential hashing/login, mock analysis isolation, test creation, and history/map serialization. Frontend checks cover API mapping and safe cache fallback. Expo web and Android exports verify that the existing navigation and legacy export imports still bundle correctly.
