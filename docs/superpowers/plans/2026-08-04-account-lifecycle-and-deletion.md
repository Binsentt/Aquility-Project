# Account Lifecycle and Permanent Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-backed guest archival and permanently delete authenticated accounts and their owned water-test files without weakening the established security model.

**Architecture:** PostgreSQL remains authoritative for account status. Authentication verifies both the JWT signature and current active account state. A focused lifecycle service archives guests, while an upload deletion service stages files around database transactions. The Expo client receives two small confirmation flows through the existing AuthContext and API client.

**Tech Stack:** Express, PostgreSQL (`pg`), JWT, bcryptjs, Node file system, Expo React Native, SecureStore, AsyncStorage, Node test runner.

---

### Task 1: Define migration and lifecycle model contracts

**Files:**
- Create: `backend/database/migrations/003_guest_archive_and_account_deletion.sql`
- Modify: `backend/config/env.js`
- Modify: `backend/.env.example`
- Modify: `backend/models/userModel.js`
- Test: `backend/tests/accountLifecycle.test.js`

- [ ] Write failing model tests for guest lifecycle fields, active-user lookup, guest archival, and expiration selection.
- [ ] Run `node --test tests/accountLifecycle.test.js` from `backend`; expect failures because lifecycle methods do not exist.
- [ ] Add non-destructive fields and indexes in migration 003, expose typed model mappings, and parameterized create/find/touch/archive queries.
- [ ] Add `GUEST_ARCHIVE_DAYS` and `GUEST_ARCHIVE_INTERVAL_MS` parsing with safe development defaults to the environment configuration and example.
- [ ] Run `node --test tests/accountLifecycle.test.js`; expect all lifecycle model tests to pass.

### Task 2: Enforce active-account JWT state and archive guests

**Files:**
- Create: `backend/services/guestLifecycleService.js`
- Modify: `backend/middleware/authMiddleware.js`
- Modify: `backend/services/authService.js`
- Modify: `backend/controllers/authController.js`
- Modify: `backend/routes/authRoutes.js`
- Modify: `backend/app.js`
- Modify: `backend/server.js`
- Test: `backend/tests/security.test.js`
- Test: `backend/tests/auth.test.js`

- [ ] Write failing tests for archived-token denial, missing/deleted-account denial, guest logout archival, expiry archival, and active registered database login.
- [ ] Run `node --test tests/security.test.js tests/auth.test.js`; expect lifecycle assertions to fail.
- [ ] Make `requireAuth` asynchronously load the user by token subject and reject absent or archived rows before every protected controller. Touch active guest activity after validation.
- [ ] Add a lifecycle service with an idempotent expiration query and server interval that is stopped during graceful shutdown.
- [ ] Add the protected logout endpoint; archive guests only and return a no-content response.
- [ ] Run the focused backend tests; expect all token and lifecycle cases to pass.

### Task 3: Permanently delete owned database records and safely stage files

**Files:**
- Create: `backend/services/uploadDeletionService.js`
- Create: `backend/services/accountService.js`
- Create: `backend/controllers/accountController.js`
- Create: `backend/routes/accountRoutes.js`
- Modify: `backend/models/waterTestModel.js`
- Modify: `backend/models/userModel.js`
- Modify: `backend/services/waterTestService.js`
- Modify: `backend/controllers/waterTestController.js`
- Modify: `backend/app.js`
- Modify: `backend/server.js`
- Test: `backend/tests/accountDeletion.test.js`
- Test: `backend/tests/waterTest.test.js`

- [ ] Write failing service and API tests for password-confirmed registered deletion, guest deletion, transaction rollback restoration, owned scan deletion, cross-user denial, missing-file tolerance, and map removal.
- [ ] Run `node --test tests/accountDeletion.test.js tests/waterTest.test.js`; expect permanent-file-deletion assertions to fail.
- [ ] Implement confined upload path resolution plus reversible staging and restore operations.
- [ ] Use one PostgreSQL transaction for account deletion and a second owner-scoped delete transaction for water tests; stage files before the transaction, restore on rollback, and remove staged files after commit.
- [ ] Mount `DELETE /api/account` behind `requireAuth`; validate registered-user passwords and never accept a client user ID as authorization.
- [ ] Run focused API tests; expect owner, rollback, file, and map assertions to pass.

### Task 4: Connect focused client confirmations and session cleanup

**Files:**
- Modify: `services/apiClient.js`
- Modify: `context/AuthContext.js`
- Modify: `utils/validation.js`
- Modify: `screens/Settings/SettingsScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`
- Create: `services/accountDeletion.test.mjs`
- Create: `utils/validation.test.mjs`

- [ ] Write failing tests for domain-neutral email validation, authenticated account deletion request, successful cache/token cleanup, and failed deletion preserving the session.
- [ ] Run `node --test services/*.test.mjs utils/*.test.mjs`; expect new assertions to fail.
- [ ] Add API client calls for logout and current-account deletion; preserve the established error-response handling.
- [ ] Add AuthContext deletion and guest-logout archival behavior, clearing SecureStore, offline cache, profile/history state, and navigation only after a successful deletion.
- [ ] Replace Gmail-only validation with the general email rule and add professional destructive confirmation modals to Settings and History detail without changing navigation.
- [ ] Run frontend unit tests; expect all existing and added tests to pass.

### Task 5: Document operation and run integrated verification

**Files:**
- Modify: `backend/README.md`
- Modify: `docs/API.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `backend/.env.example`

- [ ] Document local PostgreSQL creation, copying `.env.example`, `DATABASE_URL`, migration, seed, backend start, health check, guest archival variables, and deletion limitations/recovery behavior.
- [ ] Document protected logout and account deletion API contracts without exposing credentials or internal paths.
- [ ] Run migrations and seed against the local PostgreSQL instance, then run a live registered and guest E2E script covering archive, record deletion, account deletion, old-token rejection, and map updates.
- [ ] Run `node --test` in `backend`, `node --test services/*.test.mjs utils/*.test.mjs` in the app root, `npx expo-doctor`, `npx expo install --check`, and `npx expo export --platform android --clear`.
- [ ] Record exact pass/fail evidence and explicitly list physical-device testing, production database credentials, calibration formulas, and the deferred Expo major upgrade as remaining items.
