# Final Scientific, GPS, and History Image Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve the current Expo/Express architecture while making pH/Nitrite results traceable to captured pixels, separating scan completion from scientific classification, persisting GPS/site/lab metadata, and verifying fresh private History images.

**Architecture:** Keep the existing Sharp/CIEDE2000/HSV engine and JWT-owned water-test routes. Add a small classification/status contract around that engine, one additive migration for metadata that is not currently persisted, and fresh media serialization already used by History Detail. No client calibration, site coordinates, lab values, or threshold rules will be invented; missing inputs remain explicit null/required states.

**Tech Stack:** Node.js ESM, Express, PostgreSQL/pg, Sharp, React Native/Expo SDK 57, Node test runner, Supertest, Railway/EAS verification.

---

### Task 1: Lock down the failing scientific/status contracts

**Files:**
- Modify: `backend/tests/color-analysis.test.js`
- Modify: `backend/tests/analysis.test.js`
- Modify: `backend/tests/schema-contract.test.js`
- Modify: `services/apiMappers.test.mjs`
- Modify: `services/reportTemplate.test.mjs`
- Create: `backend/tests/measurement-status.test.js`

- [x] Add assertions that an analysis with no configured parameter thresholds returns `measuredParametersStatus: 'Not classified'`, `scientificValidationStatus: 'Pending laboratory validation'`, `overallStatus: 'NOT CLASSIFIED'`, and a `roiLocalizationStatus` explaining that separate pad coordinates are required.
- [x] Add assertions that pH and Nitrite values differ when two configured normalized ROIs contain different colors, proving the engine does not silently reuse one fixture value.
- [x] Add assertions that serialized records expose `scanStatus`, the two scientific statuses, GPS accuracy/capture time, sample code, canonical site coordinates, and null lab comparison values without manufacturing them.
- [x] Add assertions that absent map/result status never falls back to `Moderate`, and report HTML labels the field `Measured Parameters Status` while omitting Copper.
- [x] Run the focused tests and observe the new assertions fail before implementation.

### Task 2: Add isolated classification and explicit ROI diagnostics

**Files:**
- Create: `backend/services/measurementClassification.js`
- Modify: `backend/services/colorAnalysisEngine.js`
- Modify: `backend/database/colorAnalysisCalibration.json`

- [x] Implement `classifyMeasurements({ pH, nitrite, thresholds })` to return `Not classified` when no approved threshold set exists, otherwise evaluate only supplied rules; never default to Safe/Moderate/Unsafe.
- [x] Keep the current image-derived CIEDE2000 and HSV interpolation paths unchanged, but return `measuredParametersStatus`, `scientificValidationStatus`, `scanStatus: 'Completed'`, and `overallStatus: 'NOT CLASSIFIED'` from successful analysis.
- [x] Include `roiLocalizationStatus: 'PAD LOCALIZATION REQUIRED'` and per-parameter `strategy` metadata when either configured ROI is absent; retain the central fallback only as a documented provisional diagnostic, not as a pad-specific claim.
- [x] Add calibration metadata indicating that thresholds and physical pad regions are pending client confirmation; do not add numeric limits.

### Task 3: Persist sample/GPS/lab metadata with one additive migration

**Files:**
- Create: `backend/database/migrations/007_add_scientific_sample_metadata.sql`
- Modify: `backend/utils/validation.js`
- Modify: `backend/services/waterAnalysisService.js`
- Modify: `backend/models/waterTestModel.js`
- Modify: `backend/controllers/waterTestController.js`
- Modify: `services/apiClient.js`
- Modify: `services/waterAnalysisService.js`
- Modify: `components/CameraScanner/CameraView.js`

- [x] Add idempotent nullable columns for `sample_code`, `sample_number`, `gps_accuracy_meters`, `gps_captured_at`, `canonical_latitude`, `canonical_longitude`, `measured_parameters_status`, `scientific_validation_status`, `lab_ph`, and `lab_nitrite`; widen the existing overall-status check to include `NOT CLASSIFIED` without editing migrations 001–006.
- [x] Validate sample codes only for `AA-01..AA-15`, `A-01..A-15`, and `C-01..C-15`; do not invent a code when the client did not select one.
- [x] Validate GPS accuracy as a non-negative finite number and retain the actual device coordinates/timestamp separately from canonical site coordinates.
- [x] Persist and serialize lab values as nullable; expose absolute/percent differences only when both app and lab values exist.
- [x] Forward `coords.accuracy` and location capture time from CameraView through FormData/API metadata.

### Task 4: Update API/frontend contracts without redesigning navigation

**Files:**
- Modify: `backend/utils/waterTestSerializer.js`
- Modify: `services/apiMappers.js`
- Modify: `services/reportTemplate.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`
- Modify: `screens/Home/HomeScreen.js`
- Modify: `screens/Map/MapScreen.native.js`
- Modify: `screens/Map/FullMapScreen.native.js`

- [x] Serialize fresh signed `imageUri` values, actual GPS, GPS accuracy, sample/site fields, status separation, and a `labComparison` object with nulls when lab data is missing.
- [x] Change display labels to `Measured Parameters Status` and `Scientific Validation`; show scan completion independently; use `NOT CLASSIFIED`/`Not classified` for missing rules.
- [x] Remove `Moderate` defaults from result/map fallback paths; use a neutral “Not classified” label/color when the backend provides no approved class.
- [x] Keep History Detail refetch-on-focus and retry image states; ensure exports use the freshly fetched backend record and preserve the captured image URI.

### Task 5: Verify local and Railway behavior, then commit/deploy/build

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/IMAGE_ANALYSIS.md`
- Modify: `backend/README.md`

- [x] Run the complete backend/frontend test suite, Expo Doctor, dependency check, diff check, and clean web/Android exports.
- [x] Apply migration 007 to local PostgreSQL and the Railway AQUALITY database through the existing `npm run db:migrate` pre-deploy command; verify health and schema with parameterized queries.
- [x] Exercise a disposable Railway register/upload/history/image request only if a safe fixture and credentials are available; never print tokens or private media URLs.
- [ ] Stage only reviewed source/migration/test/docs files, commit with `fix: finalize sampling metadata and water analysis reporting`, push normally, redeploy the existing AQUALITY API, verify health, and build a new EAS preview APK. Report physical Android as NOT TESTED unless actually exercised.
