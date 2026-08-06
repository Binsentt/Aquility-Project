# Account Lifecycle and Permanent Deletion Design

## Purpose

Add guest archival, server-enforced account state, and permanent account and scan deletion without weakening the existing bearer-token, ownership, signed-media, scanner, map, or export protections.

## Account states

`users.account_type` continues to distinguish `registered` and `guest` users. Migration 003 adds `is_archived`, `archived_at`, `guest_expires_at`, and `last_active_at`.

- Registered users are active until they permanently delete their own account.
- Guests are active until they log out or their configurable inactivity period expires. Archiving retains the user and all scan records but prevents further authenticated use.
- Permanent deletion removes the user and cascade-owned water tests. A deleted account is indistinguishable from an unknown account at login.

## Authentication and lifecycle

Bearer signature validation remains the first check. Every protected request then loads the JWT subject from PostgreSQL, rejects absent or archived accounts, and refreshes `last_active_at` for active guests. This makes archival and permanent deletion invalidate pre-existing JWTs immediately.

`POST /api/auth/logout` archives guests and leaves registered accounts active. The lifecycle service also exposes an idempotent expiration cleanup function, driven by `GUEST_ARCHIVE_DAYS`, which the server invokes on a configurable interval.

## Permanent deletion

`DELETE /api/account` derives ownership exclusively from the bearer token. Registered users must submit their current password; guests require no password. The account service locks and deletes the authenticated account within a PostgreSQL transaction, relying on the existing `water_tests.user_id ... ON DELETE CASCADE` relationship.

Before the transaction, upload files are resolved against the configured upload root and atomically moved to a private pending-deletion directory. A database rollback restores those files. After a commit, staged files are deleted; a post-commit deletion failure stays private and is logged for safe retry rather than exposing the file.

The same staging service permanently deletes a selected owned water test and its image. No delete operation accepts a user ID as authority.

## Client behavior

The Settings screen gets an Account Management section with a destructive Delete Account action. It uses the existing modal style, requires a password field only for registered users, blocks duplicate submission, and reports safe messages.

History detail gets an equivalent permanent Delete Scan Result confirmation. Successful scan deletion updates local history immediately; focused Map and History screens refresh from their existing backend feeds. Successful account deletion clears SecureStore, the session cache, in-memory profile/history, and navigation state before displaying a success message.

## Validation and operations

Email validation becomes domain-agnostic in the Expo client while retaining the server's general email validation. The backend `.env.example` documents guest lifecycle configuration and local PostgreSQL setup. Health remains credential-free and reports database availability safely.

## Verification

Tests cover registration fields, password login, guest archive and expiry, account-state JWT enforcement, secure permanent deletion, ownership denials, signed image/file deletion, map disappearance, generic deleted login behavior, client cache clearing, and general email validation. Local PostgreSQL migration/seed/live E2E, existing test suites, Expo diagnostics, dependency check, and Android export are re-run. Physical-device behavior is explicitly not claimed without a device or emulator.
