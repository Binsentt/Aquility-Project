# AQUALITY µPAD Fiducial Registration Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove physical/body geometry from µPAD registration acceptance while preserving fiducial-based ROI localization, fail-closed analysis, and backend-derived pH/Nitrite results.

**Architecture:** Keep `backend/services/upadRegistration.js` as the image registration boundary. Its template metadata remains descriptive, while `chooseRegistration` selects candidates using visual fiducial/ROI evidence and pixel usability only. `backend/services/colorAnalysisEngine.js` continues to consume separate registered ROIs and existing calibration data; no calibration or API response shape changes are needed.

**Tech Stack:** Node.js ESM, Sharp raw pixels, Node test runner, existing React Native service/result mapper tests.

---

### Task 1: Add failing registration tests for dimension-independent acceptance

**Files:** `backend/tests/upad-registration.test.js`

- [ ] Add a complete strip fixture with a deliberately non-5:1 body but intact square, triangle, and sensing zones; assert `REGISTERED` and distinct ordered ROIs.
- [ ] Run the fixture at 50%, 75%, 100%, and 150% scales plus 90°, 180°, and 270° rotations; assert registration succeeds and semantic zone order is preserved.
- [ ] Run `node --test --test-isolation=none backend/tests/upad-registration.test.js` and confirm the new body-independent assertion fails before implementation.

### Task 2: Replace physical acceptance scoring with fiducial/ROI evidence

**Files:** `backend/services/upadRegistration.js`

- [ ] Keep `UPAD_TEMPLATE.physicalMeasurements` and `physicalProportions` as metadata, but remove `scoreRegistrationGeometry` from acceptance and confidence.
- [ ] Base confidence on square confidence, triangle confidence, stable distinct fiducials, semantic ordering, zone localization, distinct in-bounds ROIs, and usable pixel evidence.
- [ ] Remove body-dependent pair gates and body contour requirements; use only image-relative fiducial separation sufficient to establish an axis and leave both zones between anchors.
- [ ] Prefer reliable circle candidates, otherwise derive both zones from the square-to-triangle axis and `UPAD_TEMPLATE.normalized`; reject missing, shared, out-of-bounds, or unusable ROIs.
- [ ] Keep `STRIP_REGISTRATION_FAILED`, but use: `The square and triangle reference points could not be detected clearly. Please keep the entire test strip visible and capture a clear top-view image.`

### Task 3: Verify measured colors and result propagation

**Files:** `backend/tests/color-analysis.test.js`, existing engine/mapper/result files only if a verified gap is found.

- [ ] Assert different Nitrite and pH ROI colors produce different measured RGB values and separate calibration matches.
- [ ] Assert unavailable matches remain unavailable and no default pH/Nitrite is introduced.
- [ ] Run the existing frontend/service tests proving backend pH/Nitrite values reach the Result contract; add a test only for an observed gap.

### Task 4: Complete verification and integration

**Files:** only focused registration/test/spec/plan files.

- [ ] Run focused registration/scientific tests:
  `node --test --test-isolation=none backend/tests/upad-registration.test.js backend/tests/color-analysis.test.js`
- [ ] Run backend: `cd backend; npm test -- --test-isolation=none`
- [ ] Run frontend/services: `cd ..; node --test --test-isolation=none services/*.test.mjs`
- [ ] Run `git diff --check`, `npx expo install --check`, and `npx expo-doctor`.
- [ ] Stage only focused files; confirm no calibration, Expo export, `.env`, credential, or unrelated dirty file is staged.
- [ ] Commit with `fix: simplify upad fiducial registration`; push/deploy only after all checks pass. Do not rebuild the APK unless frontend/native production code changes.
