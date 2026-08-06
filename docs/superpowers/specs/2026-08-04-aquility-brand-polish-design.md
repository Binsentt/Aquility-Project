# AQUILITY brand and responsive UI polish design

**Date:** 2026-08-04  
**Status:** Approved for planning

## Goal

Replace the legacy AQUILITY wave/device branding with the supplied `assets/Aquility-Logo.png`, and make the existing Expo application feel like one responsive product without changing its navigation, scanner workflow, API contracts, Express backend, or PostgreSQL-ready data model.

## Scope

### Canonical brand asset

- Treat `assets/Aquility-Logo.png` as the sole source for in-app branding.
- Update the reusable `LogoMark` component to render that image so splash and welcome branding change through one component.
- Add the same mark to login, registration, guest, header, profile, and appropriate settings/about views. Tab icons and account avatars retain their functional iconography.
- Point the Expo application icon, web favicon, and Android adaptive-icon foreground to the canonical asset. The Android adaptive icon uses a pale-aqua background (`#EAF8FF`) for contrast.
- Add the brand mark to the report header produced by the PDF template without changing its existing report data.
- Remove the former generated logo and legacy native/logo asset files only after code and app configuration no longer reference them.

### Visual system

- Extend the existing `styles/theme.js` with a small set of shared spacing, radii, component sizing, and responsive layout tokens based on the aqua/blue palette of the supplied mark.
- Refresh shared logo, primary button, form input, card, header, loading, and tab-bar presentation before applying matching values to existing screens.
- Preserve every current route, screen name, scanner action, map marker meaning, API call, AsyncStorage fallback, and export action.
- Keep touch targets at least 48 logical pixels where controls are interactive; avoid fixed widths that would clip on compact Android devices; use flexible content width and scroll containers where a screen already scrolls.
- Retain the current status colours (Safe, Moderate, Unsafe) as semantic result indicators.

### Content cleanup

- Replace stale document-scanning wording and generic placeholder/premium language with water-quality testing language where it is user-facing.
- Keep necessary AQUILITY product and backend references, file names, and API messages intact.

## Implementation boundaries

1. No navigation architecture or backend route redesign.
2. No change to scanner calculation logic, map data handling, authentication behaviour, or export content fields.
3. `expo-file-system/legacy` stays in the export service where its legacy methods are needed.
4. The PDF header image must be resolved safely from the Expo asset system; reports must still render when the logo cannot be embedded, using a text-only heading fallback.
5. The original user-supplied logo file remains in the project; only obsolete duplicate branding assets are candidates for removal.

## Verification

- Add focused automated checks for the canonical branding configuration and PDF-logo fallback, alongside the existing mapper/cache/report tests.
- Search all tracked source/config files for old asset paths, generated-wave logo usage, and stale document-scanning copy.
- Run the backend test suite and frontend service tests.
- Run an Expo Android bundle/export validation. Attempt the installed local native Android build only when the Android toolchain is available; report any environment-only limitation distinctly from app validation.
- Manually inspect the main branded entry screens and a compact/typical Android viewport for clipping, unreachable controls, and navigation regressions.

## Acceptance criteria

- The new supplied Aquility mark appears consistently in all requested branding contexts.
- No live import or Expo configuration reference points to an obsolete logo asset.
- Existing scanner, results, history, map, settings, profile, API, backend, and export workflows preserve their current behaviour.
- PDF reports include the logo when available and retain all existing user, image, GPS/location, measurement, status, remark, and analysis data.
- Tests and the Android Expo bundle complete successfully.
