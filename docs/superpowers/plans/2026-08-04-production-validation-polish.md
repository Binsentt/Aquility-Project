# Production Validation and Targeted Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified production robustness gaps while preserving AQUILITY’s existing navigation, Expo SDK, authentication, backend architecture, and visual design.

**Architecture:** This is a validation-led maintenance pass. Backend changes remain inside existing controllers/services, client changes preserve the current screen and API contracts, and export errors are converted to established user-safe messages before presentation. No endpoint, navigation, or analysis-calibration contract changes are introduced.

**Tech Stack:** Expo SDK 54, React Native, React Navigation, Express 5, PostgreSQL, node:test, Supertest.

---

### Task 1: Prevent orphaned uploads when analysis metadata is invalid

**Files:**
- Modify: `backend/tests/analysis.test.js`
- Modify: `backend/services/waterAnalysisService.js`

- [ ] **Step 1: Write the failing regression test**

Add a `node:test` case that creates a temporary `.upload` file, calls `analyze` with a valid authenticated user and overlong barangay metadata, asserts `INVALID_INPUT`, and asserts that `fs.access(filePath)` rejects with `ENOENT`.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test tests/analysis.test.js`

Expected: FAIL because validation runs before the existing cleanup `try` block and the temporary upload still exists.

- [ ] **Step 3: Move metadata validation inside the existing cleanup boundary**

Keep authentication and ownership validation unchanged. Move coordinate, capture-time, barangay, and municipality validation into the existing `try` block before image signature validation, so every error after Multer has stored a file passes through `removeUpload`.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test tests/analysis.test.js`

Expected: PASS with the temporary upload removed.

### Task 2: Return restored sessions to the authenticated navigation flow

**Files:**
- Modify: `services/accountDeletionUi.test.mjs`
- Modify: `screens/Splash/SplashScreen.js`

- [ ] **Step 1: Write the failing source-contract regression test**

Add a test that reads `SplashScreen.js` and asserts it consumes `authLoaded` and `currentUser` from `useAuth`, waits for authentication restoration, and replaces the route with `MainTabs` for an active user.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: FAIL because Splash always replaces the route with `Welcome`.

- [ ] **Step 3: Gate splash navigation on restored auth state**

Import `useAuth`; return no timer while `authLoaded` is false; otherwise preserve the existing splash delay and call `navigation.replace(currentUser?.id ? 'MainTabs' : 'Welcome')`. Clear the timer in the effect cleanup.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: PASS.

### Task 2a: Make account-type and empty-body validation explicit

**Files:**
- Modify: `backend/tests/auth.test.js`
- Modify: `backend/controllers/userController.js`
- Modify: `backend/utils/validation.js`

- [ ] **Step 1: Write the failing endpoint regression test**

Send a body-less `POST /api/users` and a registration payload whose `accountType` is neither `registered` nor `guest`. Assert a 400 JSON error with `FULL_NAME_REQUIRED` and `INVALID_ACCOUNT_TYPE` respectively.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test tests/auth.test.js`

Expected: FAIL because the controller dereferences an absent body and treats arbitrary account-type values as registered.

- [ ] **Step 3: Add the smallest compatible validation**

Default a missing account type to `registered` for existing clients, reject any non-string/non-supported explicit value with `INVALID_ACCOUNT_TYPE`, and normalize required-field error codes to underscore-separated identifiers.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test tests/auth.test.js`

Expected: PASS.

### Task 3: Make camera, permissions, map refreshes, and destructive dialogs safe on cancellation

**Files:**
- Modify: `components/CameraScanner/CameraView.js`
- Modify: `screens/Map/MapScreen.native.js`
- Modify: `screens/Map/FullMapScreen.native.js`
- Modify: `screens/Settings/ApplicationSettings.js`
- Modify: `screens/Settings/SettingsScreen.js`
- Modify: `screens/Profile/ProfileScreen.js`

- [ ] **Step 1: Write failing source-contract checks for the confirmed guards**

Extend `services/accountDeletionUi.test.mjs` with checks that the camera owns a capture lock, Splash and destructive flows await their cleanup/navigation operation, and both native map screens invalidate asynchronous effects on cleanup.

- [ ] **Step 2: Run the targeted frontend test to verify it fails**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: FAIL because the current camera capture path has no lock and FullMap has no unmount guard.

- [ ] **Step 3: Apply only cancellation and duplicate-action guards**

Add a capture lock around `takePictureAsync` and clear it in `finally`; wrap camera/gallery permission calls in `try/catch` with the existing user-facing alerts; prevent state updates after unmount in native map and application-permission effects; close destructive dialogs before account/session reset and avoid post-reset state writes; make profile logout await the existing context logout without an additional navigation action.

- [ ] **Step 4: Run the targeted frontend test to verify it passes**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: PASS.

### Task 4: Prevent unsafe export errors from reaching the UI or device logs

**Files:**
- Create: `services/exportErrors.js`
- Create: `services/exportErrors.test.mjs`
- Modify: `services/exportService.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`

- [ ] **Step 1: Write the failing sanitizer test**

Add tests that keep explicitly user-safe export messages and replace unknown errors containing a filesystem URI, stack text, or native error detail with the supplied generic fallback.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test services/exportErrors.test.mjs`

Expected: FAIL because the sanitizer module does not yet exist.

- [ ] **Step 3: Add the small error-sanitizer module and use it at export boundaries**

Export a pure `toSafeExportMessage(error, fallback)` function with an allowlist of existing user-facing export messages. Use it when `exportService` rethrows and when Result/History display export errors. Remove unconditional export `console.error` calls and retain no filesystem path or stack in user-visible errors.

- [ ] **Step 4: Run the export test to verify it passes**

Run: `node --test services/exportErrors.test.mjs`

Expected: PASS.

### Task 5: Remove verified nonfunctional UI placeholders and dead local helpers

**Files:**
- Modify: `screens/Login/LoginScreen.js`
- Modify: `screens/Settings/ApplicationSettings.js`
- Modify: `screens/Settings/SettingsScreen.js`
- Modify: `screens/Settings/PrivacyNoticeScreen.js`
- Modify: `screens/Settings/HelpGuideScreen.js`

- [ ] **Step 1: Write the failing source-contract check**

Extend `services/accountDeletionUi.test.mjs` to assert that the login screen no longer renders a password-recovery control without an action and that application settings no longer claims to clear/reset data without invoking a real operation.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: FAIL because both placeholders are currently rendered.

- [ ] **Step 3: Remove only the nonfunctional controls and unused settings helpers**

Remove the inactive password-recovery touch target, the cache/reset controls that only show a success alert, and unused local Settings helper components. Correct privacy/help wording so it reflects server-backed water-test storage, offline cache fallback, current anonymous map behavior, and the isolated mock analysis limitation.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test services/accountDeletionUi.test.mjs`

Expected: PASS.

### Task 6: Verify full source, database, API, and Android bundle integrity

**Files:**
- Modify only if a check exposes a reproducible defect.

- [ ] **Step 1: Run source and API suites**

Run: `node --test` in `backend`; then `node --test services/*.test.mjs utils/*.test.mjs` in the project root.

Expected: all tests pass with no skipped regression cases.

- [ ] **Step 2: Run local PostgreSQL migrations, seed, and live API workflow**

Use the existing isolated local PostgreSQL development environment. Run the migration and seed scripts, then exercise registration, login, profile update, analysis upload, history/delete, map feed, account deletion, archived guest rejection, signed image retrieval, and rollback behavior through live API calls.

Expected: rows, uploads, map markers, and token behavior match the established API contracts.

- [ ] **Step 3: Run Expo validation and Android export**

Run Expo Doctor, the Expo dependency check, and `expo export --platform android --clear` using the local project CLI.

Expected: all checks pass and the Android bundle includes the Aquility branding asset.

- [ ] **Step 4: Record runtime boundary**

Document that physical Android/emulator-only camera, gallery, GPS, map rendering, PDF/image share sheet behavior are not claimed unless an actual device/emulator is used.
