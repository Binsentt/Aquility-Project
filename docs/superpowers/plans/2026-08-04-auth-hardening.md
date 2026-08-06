# AQUILITY API Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure bearer-authenticated AQUILITY profiles, records, images, and map markers without changing the existing mobile workflow or analysis contract.

**Architecture:** The backend issues JWTs and signed image URLs, authenticates protected endpoints, and performs service-level ownership checks. The Expo client stores the token in SecureStore, sends it through its shared API layer, retains AsyncStorage only for offline screen cache, and fetches authoritative record/map data before rendering/exporting.

**Tech Stack:** Node.js, Express, PostgreSQL, `jsonwebtoken`, `helmet`, `express-rate-limit`, Expo SecureStore, Expo FileSystem legacy APIs, Node test runner, Supertest.

---

### Task 1: Establish security contracts and tests

**Files:**
- Modify: `backend/tests/auth.test.js`, `backend/tests/water-tests.test.js`, `backend/tests/analysis.test.js`
- Create: `backend/tests/security.test.js`

- [ ] **Step 1: Write failing HTTP tests for token issuance, absent/invalid/expired bearer tokens, self-only profile access, owned water-test operations, and anonymous map markers.**

- [ ] **Step 2: Run `& 'C:\Program Files\nodejs\node.exe' --test tests\auth.test.js tests\water-tests.test.js tests\analysis.test.js tests\security.test.js` from `backend`; confirm failures identify missing token/middleware/map behavior.**

- [ ] **Step 3: Add only the server seams required by the failed tests, then re-run the same command until it passes.**

### Task 2: Add server token, validation, authorization, and error boundaries

**Files:**
- Create: `backend/services/authTokenService.js`, `backend/middleware/authMiddleware.js`, `backend/middleware/requestContext.js`, `backend/utils/validation.js`
- Modify: `backend/config/env.js`, `backend/app.js`, `backend/controllers/authController.js`, `backend/controllers/userController.js`, `backend/controllers/waterAnalysisController.js`, `backend/controllers/waterTestController.js`, `backend/middleware/errorHandler.js`, `backend/services/authService.js`, `backend/services/userService.js`, `backend/services/waterAnalysisService.js`, `backend/services/waterTestService.js`, `backend/routes/authRoutes.js`, `backend/routes/userRoutes.js`, `backend/routes/analysisRoutes.js`, `backend/routes/waterTestRoutes.js`, `backend/server.js`, `backend/package.json`, `backend/package-lock.json`

- [ ] **Step 1: Install the approved runtime dependencies and add environment validation for `JWT_SECRET`, token lifetimes, CORS, database pooling, and production TLS.**
- [ ] **Step 2: Implement the least code needed for the Task 1 tests: issue/verify tokens, map token errors to `401`, forbid cross-user access with `403`, validate UUID/profile/location inputs, and omit sensitive logger data.**
- [ ] **Step 3: Protect profile, analysis, water-test, and image routes; preserve existing successful response fields while adding `token` after session-creating responses.**
- [ ] **Step 4: Run the backend test suite and `npm audit --omit=dev --audit-level=high --json`; fix only hardening-pass regressions.**

### Task 3: Harden uploaded image ownership and map-feed persistence

**Files:**
- Create: `backend/controllers/mapController.js`, `backend/routes/mapRoutes.js`, `backend/database/migrations/002_security_hardening.sql`
- Modify: `backend/middleware/uploadMiddleware.js`, `backend/models/waterTestModel.js`, `backend/services/waterAnalysisService.js`, `backend/services/waterTestService.js`, `backend/utils/waterTestSerializer.js`, `backend/app.js`, `backend/database/migrate.js`, `backend/database/pool.js`

- [ ] **Step 1: Write failing tests that prove a valid image URL cannot be repurposed for another record and map items do not contain personal, image, or result-detail fields.**
- [ ] **Step 2: Run the focused tests; confirm they fail because the image is public and the map route does not exist.**
- [ ] **Step 3: Replace public static uploads with signed record-bound media delivery, validate allowed image signatures, clean up failed uploads, add service ownership checks, and implement the marker projection query.**
- [ ] **Step 4: Add migration tracking and the coordinate/date index needed by the marker query; run migrations against the isolated local PostgreSQL instance.**
- [ ] **Step 5: Re-run the full backend suite and direct local PostgreSQL flow for registration, login, capture upload, history, marker feed, image access, and cross-user denial.**

### Task 4: Move the Expo session, result/export, and map data sources behind the security boundary

**Files:**
- Create: `services/authTokenStore.js`, `services/apiClient.test.mjs`
- Modify: `services/apiClient.js`, `context/AuthContext.js`, `services/apiMappers.js`, `services/exportService.js`, `screens/Result/ResultScreen.js`, `screens/History/HistoryDetailScreen.js`, `screens/Map/MapScreen.native.js`, `screens/Map/FullMapScreen.native.js`, `package.json`, `package-lock.json`

- [ ] **Step 1: Write failing client tests for Authorization injection and a token-free request after token clearing.**
- [ ] **Step 2: Run `node --test services\apiClient.test.mjs` and confirm the expected failure.**
- [ ] **Step 3: Implement SecureStore persistence, API-client token handling and unauthorized callback, backend refresh before export, and backend map-feed loading without visual changes.**
- [ ] **Step 4: Run all client tests; bundle Android only after the code/test suite is green.**

### Task 5: Document deployment and verify end to end

**Files:**
- Create: `docs/DEPLOYMENT.md`, `docs/API.md`
- Modify: `.gitignore`, `.env.example`, `backend/.env.example`, `backend/README.md`

- [ ] **Step 1: Document environment variables, migration/startup commands, frontend configuration, protected endpoint contracts, token/media behavior, deployment checklist, and calibration replacement boundary.**
- [ ] **Step 2: Remove only proven obsolete diagnostic artifacts and stale filesystem regression notes after source-reference checks; preserve generated test outputs until verification is complete.**
- [ ] **Step 3: Run the full backend/client tests, dependency audits, local PostgreSQL end-to-end test, and `npx expo export --platform android --clear`. Record real results and device-test limits.**
