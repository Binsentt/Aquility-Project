# Classless Sample Identification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove SA/A/SB choices and make new scans use classless AQ sample codes without changing existing result calculations or historical records.

**Architecture:** The scanner keeps its 1–15 number picker and emits `AQ-NN`; both frontend and backend normalize that code without treating `AQ` as a class. New uploads retain explicit legacy classes only when supplied by an old client, never infer them from GPS. Existing nullable database columns and historical serializers remain in place.

**Tech Stack:** React Native, Expo, Node.js, Express, PostgreSQL, Node test runner, EAS preview workflow.

---

### Task 1: Prove the classless workflow fails before the implementation

**Files:**
- Modify tests: `services/sampleMetadataUi.test.mjs`
- Modify tests: `services/waterAnalysisService.test.mjs`
- Modify tests: `backend/tests/sample-sites.test.js`
- Modify tests: `backend/tests/validation.test.js`
- Modify tests: `backend/tests/analysis.test.js`

- [x] Add assertions for `AQ-01` generation/canonicalization, nullable class/site/source upload metadata, number/code agreement, and no call to the injected automatic site matcher.
- [x] Assert the scanner source has a number-only selection flow, no sample-class section/buttons/state, and continues sending camera/gallery images and the selected number.
- [x] Run the five targeted tests before changing production code; confirm failures are specifically the missing neutral-ID/no-inference behavior.

Run from repository root:

```powershell
node --test services/sampleMetadataUi.test.mjs services/waterAnalysisService.test.mjs backend/tests/sample-sites.test.js backend/tests/validation.test.js backend/tests/analysis.test.js
```

### Task 2: Make the scanner emit neutral identifiers

**Files:**
- Modify: `components/CameraScanner/CameraView.js`
- Modify: `services/sampleSites.js`
- Modify: `services/waterAnalysisService.js`

- [x] Remove `SAMPLE_CLASSES`, `selectedSampleClass`, class-option controls, class-dependent confirmation, and class-derived reaction time from the scanner.
- [x] Keep `SAMPLE_NUMBERS` 1–15 and build `AQ-${String(number).padStart(2, '0')}` whenever one is selected.
- [x] Pass `sampleClass: null`, the neutral code, and the selected number to analysis. Send only explicitly supplied class/site fields from `services/waterAnalysisService.js`; never call `matchSampleSite` during new upload preparation.
- [x] Keep a neutral reaction reminder that does not assign an invented number of minutes.

### Task 3: Accept classless uploads and preserve legacy records

**Files:**
- Modify: `backend/services/sampleSites.js`
- Modify: `backend/utils/validation.js`
- Modify: `backend/services/waterAnalysisService.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/History/HistoryScreen.js` if the no-class row is still rendered

- [x] Canonicalize `AQ-01`–`AQ-15` to themselves; keep existing SA/A/SB and AA/C legacy normalization.
- [x] Validate that any supplied number is 1–15 and agrees with a supplied AQ or legacy code.
- [x] Resolve a class/site only from explicit legacy `sampleClass` metadata. Do not infer class or site from coordinates or from an AQ code.
- [x] Leave database schema unchanged; keep legacy classes visible and omit empty class rows for new classless scans.
- [x] Run targeted tests and then the full backend/mobile suites.

### Task 4: Complete handoff checks and release on the review branch

**Files:**
- Update: `turnover/` only for verified stale or unsafe files
- Update: `docs/FINAL_HANDOFF_STATUS_2026-11-13.md`

- [x] Verify current workbook availability; if absent, leave calibration data untouched and document the missing source.
- [x] Verify manual-location API capability and migration 008 without changing production data.
- [x] Run `git diff --check`, root/backend dependency audits, Expo config validation, and test suites.
- [x] Sanitize and archive `turnover/` without including environment files, credentials, logs, private uploads, or production database data.
- [ ] Commit tested changes and handoff artifacts on `review/final-aquality-bugfixes`, push without force, and verify remote SHA.
- [ ] Use the existing review-branch EAS preview workflow once; verify its artifact. Request separate production Railway authorization before claiming the classless APK is end-to-end ready.
