# AQUILITY Brand and Responsive UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the supplied Aquility logo consistently and polish the existing Expo UI without changing navigation, scanner, API, or backend behaviour.

**Architecture:** The supplied PNG remains the one canonical brand source. Shared theme and UI components provide the new visual baseline; existing screens consume those tokens and retain their current routes, handlers, data shapes, and backend calls. The PDF pipeline resolves the same Expo asset through the existing legacy file-system service and falls back safely to a text heading when the logo cannot be embedded.

**Tech Stack:** Expo SDK 54, React Native, React Navigation, Expo Asset/Print/FileSystem legacy, Node test runner, Express/PostgreSQL backend.

---

## File structure

- `assets/Aquility-Logo.png` — canonical source asset; preserved.
- `app.json` — Expo icon, Android adaptive icon, and favicon configuration.
- `components/Logo/LogoMark.js` — reusable rendered in-app mark.
- `styles/theme.js` — colours plus shared spacing, radii, sizing, layout, and shadows.
- `components/{Button,Card,Header,Input,Loading,BottomNavigation}` — shared UI presentation only.
- `screens/{Splash,Welcome,Login,Register,GuestInfo,Home,Profile,History,Result,Settings,Map,Scan}` — targeted layout, copy, and branded header improvements; route names and callbacks remain unchanged.
- `services/reportTemplate.js` — pure HTML rendering with an optional brand image source.
- `services/exportService.js` — resolve the local Expo logo into a PDF-safe data URI using `expo-file-system/legacy`.
- `services/branding.test.mjs` and `services/reportTemplate.test.mjs` — static branding/configuration and PDF fallback tests.

### Task 1: Establish and test the canonical branding contract

**Files:**
- Create: `services/branding.test.mjs`
- Modify: `app.json`
- Modify: `components/Logo/LogoMark.js`
- Delete after verification: `assets/icon.png`, `assets/android-icon-background.png`, `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`, `assets/favicon.png`, `assets/splash-icon.png`

- [ ] **Step 1: Write the failing Node test for the one asset configuration**

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const logoComponent = readFileSync(new URL('../components/Logo/LogoMark.js', import.meta.url), 'utf8');

test('the supplied Aquility logo is the sole configured application branding asset', () => {
  const logoPath = './assets/Aquility-Logo.png';
  assert.equal(appConfig.expo.icon, logoPath);
  assert.equal(appConfig.expo.android.adaptiveIcon.foregroundImage, logoPath);
  assert.equal(appConfig.expo.android.adaptiveIcon.backgroundColor, '#EAF8FF');
  assert.equal(appConfig.expo.web.favicon, logoPath);
  assert.ok(existsSync(new URL('../assets/Aquility-Logo.png', import.meta.url)));
  assert.match(logoComponent, /Image/);
  assert.match(logoComponent, /Aquility-Logo\.png/);
  assert.doesNotMatch(logoComponent, /name="waves"/);
});
```

- [ ] **Step 2: Run the test and confirm it fails against the legacy icon paths and wave mark**

Run: `node --test services/branding.test.mjs`  
Expected: FAIL because `app.json` still references `icon.png` and `LogoMark` still renders `waves`.

- [ ] **Step 3: Point Expo and the reusable mark to the canonical source**

Replace the manifest icon configuration with:

```json
"icon": "./assets/Aquility-Logo.png",
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#EAF8FF",
    "foregroundImage": "./assets/Aquility-Logo.png"
  }
},
"web": { "favicon": "./assets/Aquility-Logo.png" }
```

Render the component from the same source, retaining its `showLabel` and `size` API:

```jsx
import { Image, StyleSheet, Text, View } from 'react-native';

const logoSource = require('../../assets/Aquility-Logo.png');

export default function LogoMark({ showLabel = true, size = 92 }) {
  return (
    <View style={styles.container}>
      <Image source={logoSource} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Aquility logo" />
      {showLabel ? <Text style={styles.label}>AQUILITY</Text> : null}
    </View>
  );
}
```

- [ ] **Step 4: Remove only unreferenced legacy brand files**

First run `rg -n "(icon\.png|android-icon-|favicon\.png|splash-icon\.png)" app.json App.js components screens services`. It must return no active reference. Then remove exactly the six files listed above, leaving `Aquility-Logo.png` in place.

- [ ] **Step 5: Run the branding test and static-reference search**

Run: `node --test services/branding.test.mjs`  
Expected: PASS.

Run: `rg -n "(icon\.png|android-icon-|favicon\.png|splash-icon\.png|name=\"waves\")" app.json components screens services`  
Expected: no matches.

- [ ] **Step 6: Checkpoint**

This workspace is not a Git repository, so do not attempt a commit. Record the completed task in this plan instead.

### Task 2: Add a logo-backed PDF header with a safe fallback

**Files:**
- Modify: `services/reportTemplate.js`
- Modify: `services/reportTemplate.test.mjs`
- Modify: `services/exportService.js`

- [ ] **Step 1: Extend the pure report-template test with branded and fallback cases**

```js
test('buildPdfHtml renders the Aquility mark only when a resolved brand image is supplied', () => {
  const branded = buildPdfHtml({ brandImageUri: 'data:image/png;base64,brand' });
  const fallback = buildPdfHtml();

  assert.match(branded, /data-brand-logo="aquility"/);
  assert.match(branded, /data:image\/png;base64,brand/);
  assert.doesNotMatch(fallback, /data-brand-logo="aquility"/);
  assert.match(fallback, /AQUILITY Water Test Report/);
});
```

- [ ] **Step 2: Run the report test and confirm the new case fails**

Run: `node --test services/reportTemplate.test.mjs`  
Expected: FAIL because `buildPdfHtml` ignores `brandImageUri`.

- [ ] **Step 3: Add the optional, escaped header image to the HTML renderer**

Change the function signature to `buildPdfHtml({ user = {}, test = {}, brandImageUri = null } = {})`. At the top of the HTML body, render the image only when `brandImageUri` is truthy:

```html
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 22px;">
  ${brandImageUri ? `<img data-brand-logo="aquility" src="${escapeHtml(brandImageUri)}" style="width: 48px; height: 48px; object-fit: contain;" />` : ''}
  <div>
    <h1 style="font-size: 28px; margin: 0 0 4px;">AQUILITY Water Test Report</h1>
    <p style="margin: 0; color: #4D6478;">Water-quality test report generated from an AQUILITY record.</p>
  </div>
</div>
```

Keep the existing user, image, chemistry, GPS, map, status, and remarks sections unchanged.

- [ ] **Step 4: Resolve the bundled image inside the existing legacy export service**

Keep `import * as FileSystem from 'expo-file-system/legacy'`, add `import { Asset } from 'expo-asset'`, and add this helper above `createPdfExport`:

```js
const brandLogoSource = require('../assets/Aquility-Logo.png');

async function resolvePdfBrandImageUri() {
  try {
    const asset = Asset.fromModule(brandLogoSource);
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;
    if (!localUri) return null;
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64 ? `data:image/png;base64,${base64}` : null;
  } catch (error) {
    logExportDebug('brand-logo-unavailable', { errorMessage: error?.message || 'Unknown error' });
    return null;
  }
}
```

Build the PDF as `buildPdfHtml({ user: payload?.user, test: payload, brandImageUri: await resolvePdfBrandImageUri() })`. A resolver failure must not fail the report export.

- [ ] **Step 5: Run all pure frontend tests**

Run: `node --test services/branding.test.mjs services/apiMappers.test.mjs services/sessionCache.test.mjs services/reportTemplate.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 6: Checkpoint**

Do not alter report payload fields, export filenames, sharing logic, or the `expo-file-system/legacy` import.

### Task 3: Define and apply shared UI presentation tokens

**Files:**
- Modify: `styles/theme.js`
- Modify: `components/Button/PrimaryButton.js`
- Modify: `components/Card/StatCard.js`
- Modify: `components/Header/TopHeader.js`
- Modify: `components/Input/FormInput.js`
- Modify: `components/Loading/LoadingIndicator.js`
- Modify: `components/BottomNavigation/BottomTabBar.js`

- [ ] **Step 1: Add shared presentation tokens without changing existing semantic colours**

Export these values from `styles/theme.js` and use them rather than new hard-coded spacings in touched files:

```js
export const SPACING = { xs: 6, sm: 10, md: 16, lg: 20, xl: 24, xxl: 32 };
export const RADII = { control: 14, card: 22, hero: 28, pill: 999 };
export const SIZES = { touchTarget: 48, contentMaxWidth: 640 };
export const LAYOUT = { pagePadding: 18, bottomTabClearance: 110 };
```

Retain Safe/Moderate/Unsafe semantic result colours and update primary/accent shades only within the current blue/aqua brand family.

- [ ] **Step 2: Make shared controls responsive and accessible**

Apply `SIZES.touchTarget` to `PrimaryButton` and the password visibility touch target. Give `PrimaryButton` an optional `variant = 'primary'` prop and map `secondary` to a pale-aqua background plus `COLORS.primary` label, so the existing Login secondary action is readable. Keep its current `title`, `onPress`, `disabled`, `style`, and spread props API.

For `TopHeader`, preserve `title`/`subtitle` and add the current `LogoMark` on the trailing side. For `StatCard`, retain `title`, `value`, and `style`, while allowing text to wrap rather than clip critical status. Keep tab icons unchanged; use safe-area insets only to position the existing bar above Android gesture space.

- [ ] **Step 3: Preserve compact Android layouts**

Use `maxWidth: SIZES.contentMaxWidth`, `alignSelf: 'center'`, flexible widths, and existing scroll containers instead of device-specific breakpoints. Avoid changing navigator configuration or tab route names.

- [ ] **Step 4: Run the pure frontend tests**

Run: `node --test services/branding.test.mjs services/apiMappers.test.mjs services/sessionCache.test.mjs services/reportTemplate.test.mjs`  
Expected: all tests PASS; this confirms the visual-token changes did not affect mapper, cache, report, or asset configuration contracts.

### Task 4: Apply branding and form polish to entry, home, and profile surfaces

**Files:**
- Modify: `screens/Splash/SplashScreen.js`
- Modify: `screens/Welcome/WelcomeScreen.js`
- Modify: `screens/Login/LoginScreen.js`
- Modify: `screens/Register/RegisterScreen.js`
- Modify: `screens/GuestInfo/GuestInfoScreen.js`
- Modify: `screens/Home/HomeScreen.js`
- Modify: `screens/Profile/ProfileScreen.js`
- Modify: `screens/Settings/ProfileSettings.js`
- Modify: `screens/Settings/EditProfileScreen.js`
- Modify: `screens/Settings/AboutSettings.js`

- [ ] **Step 1: Put the canonical component on every approved in-app brand surface**

Use `<LogoMark showLabel={false} size={...} />` in login, registration, guest, profile, profile settings, and about header/card contexts. Use the labelled `LogoMark` only when it replaces a standalone full brand block (splash/welcome). Do not replace account avatars or tab icons.

- [ ] **Step 2: Align card and control geometry**

Use `SPACING`, `RADII`, `SIZES`, `LAYOUT`, and `SHADOWS` in the existing styles. Constrain content cards with `width: '100%'`, `maxWidth: SIZES.contentMaxWidth`, and `alignSelf: 'center'`; preserve `ScrollView`, `Formik`, `loginUser`, `registerUser`, `loginGuest`, and profile update handlers exactly as they are.

- [ ] **Step 3: Replace stale entry and home wording only**

Use these visible strings:

```text
Login: "Sign in to view and manage your water-quality test records."
Home empty state: "No saved water tests yet. Capture or select a test strip to begin."
Home next step: "Capture a water-test strip image to create a new analysis."
```

No API keys, payload property names, navigation targets, or validation labels change.

- [ ] **Step 4: Run an Expo web export for a quick render check**

Run: `node .\node_modules\expo\bin\cli export --platform web --clear`  
Expected: `Exported` output with no missing-asset or module-resolution errors.

### Task 5: Polish water-test workflow, history, result, map, and settings presentation

**Files:**
- Modify: `components/CameraScanner/CameraView.js`
- Modify: `components/CameraScanner/CaptureButton.js`
- Modify: `components/CameraScanner/GalleryButton.js`
- Modify: `components/CameraScanner/ScannerOverlay.js`
- Modify: `screens/History/HistoryScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/Map/MapScreen.native.js`
- Modify: `screens/Map/MapScreen.web.js`
- Modify: `screens/Map/FullMapScreen.native.js`
- Modify: `screens/Map/FullMapScreen.web.js`
- Modify: `screens/Settings/SettingsScreen.js`
- Modify: `screens/Settings/ApplicationSettings.js`
- Modify: `screens/Settings/HelpGuideScreen.js`
- Modify: `screens/Settings/NotificationsSettings.js`
- Modify: `screens/Settings/PrivacyNoticeScreen.js`
- Modify: `screens/Settings/TermsOfUseScreen.js`

- [ ] **Step 1: Update user-facing scanner vocabulary without renaming its detector or handler interfaces**

Change visible strings such as `Center the document in the guide.`, `Document aligned.`, `Scan Document`, and `Capture document` to water-test strip equivalents. Keep `createDocumentDetector`, `analyzeDocument`, and their current API-compatible call shapes untouched unless a purely internal rename is required by an import; do not change capture, location, upload, or result navigation behaviour.

- [ ] **Step 2: Apply the shared card/control treatment to record and result screens**

Use the established token set for headers, search bars, result cards, metric boxes, export controls, empty states, map callouts, and settings rows. Preserve the current Safe/Moderate/Unsafe marker data, `refreshHistory` API call, result payload shape, export handlers, delete handler, and map navigation callbacks. Allow metric and export button rows to wrap rather than clip on narrow screens.

- [ ] **Step 3: Replace remaining visible document-scanning copy**

Replace exact stale concepts with water-test equivalents in History, Result, Help, Privacy, and Terms screens, including:

```text
"Document Scan" -> "Water Test"
"document scanning workflow" -> "water-quality testing workflow"
"document-review assistance" -> "water-quality testing assistance"
"document capture" -> "water-test strip capture"
```

Do not rewrite internal API names or file-system directories that are not user-facing.

- [ ] **Step 4: Search for stale user-facing terminology**

Run: `rg -n -i "document scan|scan document|document-review|document scanning|premium AQUILITY" components screens services --glob '*.js'`  
Expected: no user-facing stale phrase remains. Any internal detector/function name is retained only when it has no visible text.

- [ ] **Step 5: Run the pure frontend tests**

Run: `node --test services/branding.test.mjs services/apiMappers.test.mjs services/sessionCache.test.mjs services/reportTemplate.test.mjs`  
Expected: all tests PASS.

### Task 6: Verify production compatibility and Android bundling

**Files:**
- Modify: `docs/superpowers/plans/2026-08-04-aquility-brand-polish.md` (check task boxes only)

- [ ] **Step 1: Run the backend regression suite**

Run from `backend`: `& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test`  
Expected: the existing Express route, authentication, water-test, and schema tests all PASS.

- [ ] **Step 2: Run frontend pure tests with the known-good Node executable**

Run from the Expo app root: `& 'C:\Program Files\nodejs\node.exe' --test services\branding.test.mjs services\apiMappers.test.mjs services\sessionCache.test.mjs services\reportTemplate.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 3: Validate all asset imports and legacy filesystem use**

Run:

```powershell
rg -n "Aquility-Logo\.png|expo-file-system/legacy" app.json components screens services
rg -n "(icon\.png|android-icon-|favicon\.png|splash-icon\.png|name=\"waves\")" app.json components screens services
```

Expected: first search identifies all intended canonical uses and the legacy export import; second search returns no references.

- [ ] **Step 4: Compile the Expo Android bundle**

Run: `& 'C:\Program Files\nodejs\node.exe' '.\node_modules\expo\bin\cli' export --platform android --clear`  
Expected: Android bundle exports with no asset, module, or transform errors.

- [ ] **Step 5: Assess native Android build availability without generating a new native architecture**

Run: `Get-ChildItem Env:ANDROID_HOME,Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue; Test-Path android`  
Expected: if an existing `android` directory and Android SDK variables are present, run the pre-existing native build command. Otherwise report that the managed Expo Android bundle succeeded and a client-side EAS/native build needs the Android toolchain; do not run prebuild or add a native project outside scope.

- [ ] **Step 6: Perform a visual smoke check and report**

Review splash, welcome, login, home, scan permission/controls, history, result, map, profile, and settings at compact and typical Android widths. Confirm no overlap, clipped buttons, missing logo, navigation issue, API error, scanner action change, map-marker semantic change, or export regression.
