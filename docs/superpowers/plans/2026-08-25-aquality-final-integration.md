# AQUALITY Final Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename active product branding to AQUALITY, keep pH and nitrate as the only active analysis parameters, and make the existing Expo + Express + PostgreSQL workflow ready for local LAN Android testing without changing navigation or security architecture.

**Architecture:** Preserve the current backend routes, JWT ownership checks, guest lifecycle, deletion transactions, upload storage, and report contracts. Update only active labels/messages/configuration, use the existing `EXPO_PUBLIC_API_BASE_URL` as the single mobile endpoint source, explicitly bind development HTTP on all LAN interfaces, and document the local `aquality` database setup. Historical migrations, persistent cache/token keys, package/bundle identifiers, API issuer/audience, and existing API service identity remain compatibility identifiers unless a new migration is required.

**Tech Stack:** Expo SDK 54, React Native, Express, PostgreSQL, `pg`, dotenv, JWT, SecureStore, legacy Expo filesystem APIs for existing exports.

---

### Task 1: Add regression coverage for final integration contracts

**Files:**
- Modify: `services/branding.test.mjs`
- Modify: `services/apiClient.test.mjs`
- Modify: `backend/tests/health.test.js`
- Create: `backend/tests/config.test.js`

- [x] Assert the visible Expo name is `AQUALITY`, the renamed logo asset is configured, and active report markup uses AQUALITY.
- [x] Assert network failures from the shared API client become the approved user-facing connection error and preserve the `NETWORK_UNAVAILABLE` code.
- [x] Assert the backend development environment exposes a LAN bind host while production defaults remain loopback-safe.
- [x] Assert the health endpoint keeps its compatibility service identifier while returning the connected database field.

### Task 2: Rename active branding without changing persistent identifiers

**Files:**
- Modify: `app.json`
- Modify: `components/Logo/LogoMark.js`
- Modify: `services/exportService.js`
- Modify: `services/reportTemplate.js`
- Modify: active screen/context/backend user-facing messages and `README.md`, `backend/README.md`, `docs/API.md`, `docs/DEPLOYMENT.md`
- Rename: `assets/AQUALITY-Logo.png` is the active text-free logo asset (renamed from the old filename during implementation)

- [x] Replace visible labels, titles, alerts, reports, privacy/help/terms copy, and backend error/startup copy with AQUALITY.
- [x] Point all active image references to `assets/AQUALITY-Logo.png` and preserve the text-free image content.
- [x] Keep package name, Expo slug, Android/iOS IDs, cache keys, SecureStore key, JWT issuer/audience, API service identity, and historical plans/migrations unchanged; document these as compatibility identifiers.

### Task 3: Keep pH and nitrate as the only active parameters

**Files:**
- Modify: active parameter tests/documentation only where they describe current behavior.
- Preserve: `backend/database/migrations/001_initial_schema.sql` and `004_remove_copper_parameter.sql` as historical migration files.

- [x] Verify serializers, analysis engine, API responses, Result/History/Map, PDF/PNG, fixtures, and generated builds contain no active Copper fields.
- [x] Add/update a current schema contract assertion that the post-migration schema has `estimated_ph` and `estimated_nitrate` but no Copper columns.
- [x] Keep mock calibration data isolated in `backend/services/colorAnalysisEngine.js` and its reference JSON files.

### Task 4: Make local PostgreSQL and LAN API configuration explicit

**Files:**
- Modify: `.env.example`
- Modify: `backend/.env.example`
- Modify: `backend/config/env.js`
- Modify: `backend/server.js`
- Modify: `services/apiClient.js`
- Modify: `.gitignore` if required

- [x] Set the documented local DB default to `aquality` without creating a real `.env` or hardcoded credentials.
- [x] Add a development bind host default of `0.0.0.0` and use it in `server.listen`; keep production loopback unless `HOST` is explicitly configured.
- [x] Keep `DATABASE_SSL=false` working locally and preserve the clear missing-`DATABASE_URL` error.
- [x] Keep `EXPO_PUBLIC_API_BASE_URL` as the single mobile URL source, with localhost as the safe web/default fallback and a documented LAN override.
- [x] Convert fetch/network failures into a friendly AQUALITY server connection message without exposing stack traces or paths.

### Task 5: Document and verify the local workflow

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/API.md`

- [x] Document PostgreSQL/VS Code connection values, migration and seed scripts from `backend/package.json`, backend startup, LAN IP/API URL configuration, health verification, firewall/Wi-Fi checks, and mock-calibration replacement files.
- [x] Mark live PostgreSQL and physical Android checks only when actually available.

### Task 6: Run the complete verification matrix

- [x] Run backend and frontend tests.
- [x] Run Expo Doctor and dependency checks.
- [x] Run clean web and Android exports to `dist-web` and `dist-export`.
- [x] Search runtime source and generated output for unexplained AQUALITY predecessor or Copper references.
- [x] Check local PostgreSQL availability and report live migration/health status honestly.
- [x] Report physical Android device checks separately from build verification.
