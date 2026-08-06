# AQUILITY Full-Stack Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PostgreSQL-ready Express backend and migrate existing AQUILITY profile, analysis, history, map, and PDF data flows to its REST API without replacing Expo navigation or screen structure.

**Architecture:** The Expo app keeps `AuthContext` as its screen-facing state boundary. A sibling Express service persists public user and water-test data to PostgreSQL, owns uploads and mock analysis, and exposes a stable REST contract. The context caches successful API responses only for offline/session recovery and converts API data to the existing screen shape.

**Tech Stack:** Expo SDK 54, React Native, Express, PostgreSQL (`pg`), Multer, bcryptjs, dotenv, node:test, supertest, expo-file-system/legacy, expo-print.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `backend/server.js`, `backend/app.js` | Process bootstrap and testable Express composition |
| `backend/config/env.js`, `backend/database/pool.js` | Validated environment and PostgreSQL connection |
| `backend/database/migrations/001_initial_schema.sql` | Users and water-tests tables, foreign key, indexes |
| `backend/database/mock*.json`, `backend/database/seed.js` | Replaceable calibration/reference/sample fixtures and seed command |
| `backend/models/*Model.js` | SQL-only user and water-test access |
| `backend/services/*` | Authentication, analysis, and record orchestration |
| `backend/controllers/*`, `backend/routes/*` | HTTP validation and response wiring |
| `backend/middleware/*` | JSON errors, not-found response, and upload handling |
| `services/apiClient.js`, `services/apiMappers.js` | One frontend HTTP boundary and screen-shape mapping |
| `context/AuthContext.js` | API-backed profile/history state plus narrow cache fallback |
| `components/CameraScanner/CameraView.js` | Upload capture metadata and navigate with the backend result |
| `services/waterAnalysisService.js` | Delegates to the backend; contains no mock values |
| `screens/*` touched below | Await context calls and display backend-derived data in their present layouts |
| `services/exportService.js` | Report composition with legacy file-system calls |

### Task 1: Create the backend shell and health boundary

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/app.js`
- Create: `backend/server.js`
- Create: `backend/config/env.js`
- Create: `backend/middleware/errorHandler.js`
- Create: `backend/routes/healthRoutes.js`
- Create: `backend/tests/health.test.js`

- [ ] **Step 1: Write the failing health test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

test('GET /api/health reports the service name', async () => {
  const response = await request(createApp()).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', service: 'aquility-api' });
});
```

- [ ] **Step 2: Run the test to verify the missing-app failure**

Run: `npm test -- --test-name-pattern="service name"`

Expected: failure because `backend/app.js` does not exist.

- [ ] **Step 3: Add the minimal app composition**

```js
export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/health', healthRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
```

`server.js` loads the pool once, runs `pool.query('SELECT 1')`, then listens on `PORT`. `.env.example` defines `PORT=4000`, `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aquility`, `UPLOAD_DIR=./uploads`, and `CORS_ORIGIN=*`.

- [ ] **Step 4: Run the test**

Run: `npm test -- --test-name-pattern="service name"`

Expected: PASS.

### Task 2: Define PostgreSQL schema and replaceable fixtures

**Files:**
- Create: `backend/database/migrations/001_initial_schema.sql`
- Create: `backend/database/mockCalibration.json`
- Create: `backend/database/mockColorReference.json`
- Create: `backend/database/mockWaterSamples.json`
- Create: `backend/database/seed.js`
- Create: `backend/tests/schema-contract.test.js`

- [ ] **Step 1: Write the schema contract test**

```js
test('initial schema defines users and water_tests with result and GPS columns', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const column of ['password_hash', 'latitude', 'longitude', 'estimated_ph', 'estimated_nitrate', 'estimated_copper', 'overall_status']) {
    assert.match(sql, new RegExp(column, 'i'));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="initial schema"`

Expected: failure because the migration does not exist.

- [ ] **Step 3: Create the migration and fixtures**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT,
  barangay TEXT,
  municipality TEXT,
  password_hash TEXT,
  account_type TEXT NOT NULL DEFAULT 'registered' CHECK (account_type IN ('registered', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE water_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  barangay TEXT,
  municipality TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  estimated_ph NUMERIC(4,2) NOT NULL,
  ph_status TEXT NOT NULL,
  estimated_nitrate NUMERIC(8,2) NOT NULL,
  nitrate_status TEXT NOT NULL,
  estimated_copper NUMERIC(8,3) NOT NULL,
  copper_status TEXT NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('Safe', 'Moderate', 'Unsafe')),
  remarks TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX water_tests_user_created_idx ON water_tests (user_id, created_at DESC);
CREATE INDEX water_tests_coordinates_idx ON water_tests (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

The JSON sample must contain the fixed mock result `{ "pH": 6.8, "nitrate": 3.5, "copper": 0.6, "overallStatus": "Safe" }`; calibration and color-reference files include named, documented mock bands.

- [ ] **Step 4: Run the test**

Run: `npm test -- --test-name-pattern="initial schema"`

Expected: PASS.

### Task 3: Implement user persistence and secure authentication

**Files:**
- Create: `backend/models/userModel.js`
- Create: `backend/services/authService.js`
- Create: `backend/controllers/userController.js`
- Create: `backend/controllers/authController.js`
- Create: `backend/routes/userRoutes.js`
- Create: `backend/routes/authRoutes.js`
- Create: `backend/tests/users.test.js`

- [ ] **Step 1: Write failing user/auth tests with a fake model**

```js
test('register hashes the password and never returns it', async () => {
  const created = await authService.register({ fullName: 'Ana Cruz', email: 'ana@example.test', password: 'password123' });
  assert.equal(created.password, undefined);
  assert.equal(created.passwordHash, undefined);
  assert.match(fakeUserModel.inserted.passwordHash, /^\$2/);
});

test('login returns 401 for invalid credentials', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: 'ana@example.test', password: 'wrong-password' });
  assert.equal(response.status, 401);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="password|credentials"`

Expected: FAIL because auth service and routes are missing.

- [ ] **Step 3: Implement public-user shaping and SQL access**

```js
export const toPublicUser = ({ passwordHash, password_hash, ...user }) => user;
export async function register(payload) {
  const passwordHash = await bcrypt.hash(payload.password, 12);
  return toPublicUser(await userModel.create({ ...payload, passwordHash, accountType: 'registered' }));
}
export async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return toPublicUser(user);
}
```

Guest creation sets `accountType: 'guest'`, accepts no password, and permits a null email. User update SQL accepts only public profile columns.

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern="password|credentials"`

Expected: PASS.

### Task 4: Implement the isolated mock-analysis and upload flow

**Files:**
- Create: `backend/services/colorAnalysisEngine.js`
- Create: `backend/services/waterAnalysisService.js`
- Create: `backend/middleware/uploadMiddleware.js`
- Create: `backend/controllers/waterAnalysisController.js`
- Create: `backend/routes/analysisRoutes.js`
- Create: `backend/tests/analysis.test.js`

- [ ] **Step 1: Write failing analysis tests**

```js
test('mock engine returns values from mockWaterSamples without reading image pixels', async () => {
  const result = await colorAnalysisEngine.analyze({ imagePath: '/uploads/strip.png' });
  assert.deepEqual(result, { pH: 6.8, nitrate: 3.5, copper: 0.6, overallStatus: 'Safe', remarks: 'Water quality appears acceptable based on the current estimated values.' });
});

test('analysis endpoint rejects a request without an image', async () => {
  const response = await request(app).post('/api/analyze-water').field('userId', userId);
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'IMAGE_REQUIRED');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="mock engine|without an image"`

Expected: FAIL because no analysis module or endpoint exists.

- [ ] **Step 3: Implement upload validation and the stable result response**

```js
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageOnly });
export async function analyzeWater({ file, metadata }) {
  const measured = await colorAnalysisEngine.analyze({ imagePath: `/uploads/${file.filename}`, calibration, colorReference });
  const test = await waterTestModel.create({ ...metadata, imagePath: `/uploads/${file.filename}`, ...measured });
  return serializeWaterTest(test);
}
```

`serializeWaterTest` returns `analysisId`, numeric `pH`, `{ value, unit, status }` nitrate and copper fields, `overallStatus`, `remarks`, `gps`, `capturedAt`, and `analyzedAt`; it also returns the screen-compatible fields used by the frontend mapper.

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern="mock engine|without an image"`

Expected: PASS.

### Task 5: Implement water-test history and map data APIs

**Files:**
- Create: `backend/models/waterTestModel.js`
- Create: `backend/controllers/waterTestController.js`
- Create: `backend/routes/waterTestRoutes.js`
- Modify: `backend/app.js`
- Create: `backend/tests/water-tests.test.js`

- [ ] **Step 1: Write failing history tests**

```js
test('GET /api/water-tests returns newest records with public user profile and GPS', async () => {
  const response = await request(app).get(`/api/water-tests?userId=${userId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.items[0].overallStatus, 'Safe');
  assert.deepEqual(response.body.items[0].gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(response.body.items[0].user.passwordHash, undefined);
});

test('DELETE /api/water-tests/:id returns 204', async () => {
  assert.equal((await request(app).delete(`/api/water-tests/${testId}`)).status, 204);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="newest records|returns 204"`

Expected: FAIL because the water-test routes are missing.

- [ ] **Step 3: Implement list/detail/delete handlers**

```js
router.get('/', listWaterTests);
router.get('/:id', getWaterTest);
router.delete('/:id', deleteWaterTest);

export async function listWaterTests(req, res) {
  const items = await waterTestModel.list({ userId: req.query.userId });
  res.json({ items: items.map(serializeWaterTest) });
}
```

The list query joins `users`, orders `water_tests.created_at DESC`, and returns `user`, status, numeric values, image URL, capture time, GPS, barangay, municipality, and remarks.

- [ ] **Step 4: Run tests**

Run: `npm test -- --test-name-pattern="newest records|returns 204"`

Expected: PASS.

### Task 6: Add the frontend API client and normalized mappers

**Files:**
- Create: `services/apiClient.js`
- Create: `services/apiMappers.js`
- Create: `services/apiClient.test.js`
- Modify: `.env.example`

- [ ] **Step 1: Write failing mapper tests**

```js
test('toScanResult maps an API water test into the existing result screen shape', () => {
  assert.deepEqual(toScanResult(apiTest).resultData, {
    pH: '6.80',
    Nitrate: '3.50 mg/L',
    'Copper (Cu²⁺)': '0.600 mg/L',
  });
  assert.equal(toScanResult(apiTest).location.latitude, 14.6);
});
```

- [ ] **Step 2: Run the mapper test to verify failure**

Run: `node --test services/apiClient.test.js`

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Implement a single request boundary**

```js
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:4000/api';
export async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ApiError(response.status, body?.error?.message || 'Request failed');
  return body;
}
export const api = { createUser, updateUser, login, analyzeWater, listWaterTests, getWaterTest, deleteWaterTest };
```

`analyzeWater` uses `FormData`, attaches `{ uri, name: 'water-strip.jpg', type: 'image/jpeg' }`, and sends user/location metadata. Mappers convert camelCase API fields into the existing `imageUri`, `location`, `summary`, `resultData`, and `status` fields.

- [ ] **Step 4: Run tests**

Run: `node --test services/apiClient.test.js`

Expected: PASS.

### Task 7: Migrate AuthContext and authentication/profile screens

**Files:**
- Modify: `context/AuthContext.js`
- Modify: `screens/Register/RegisterScreen.js`
- Modify: `screens/Login/LoginScreen.js`
- Modify: `screens/GuestInfo/GuestInfoScreen.js`
- Modify: `screens/Settings/EditProfileScreen.js`
- Modify: `screens/Settings/SettingsScreen.js`

- [ ] **Step 1: Write the failing context behavior test**

```js
test('offline hydration restores only cached session and successful API data overwrites cache', async () => {
  await hydrateSession();
  assert.equal(storage.getItem('aquility:registered-users'), null);
  await refreshWaterTests();
  assert.equal(JSON.parse(storage.getItem('aquility:scan-history-cache')).items.length, 1);
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `node --test context/AuthContext.test.js`

Expected: FAIL because current context persists registered users and scan history as primary state.

- [ ] **Step 3: Replace local ownership with API ownership**

```js
const registerUser = async (payload) => setCurrentUser(await api.createUser(toRegistrationPayload(payload)));
const loginUser = async (email, password) => setCurrentUser(await api.login({ email, password }));
const loginGuest = async (payload) => setCurrentUser(await api.createUser({ ...toGuestPayload(payload), accountType: 'guest' }));
const updateUserProfile = async (updates) => setCurrentUser(await api.updateUser(currentUser.id, toProfilePayload(updates)));
```

Persist only `aquility:session`, `aquility:user-cache`, and `aquility:scan-history-cache`. Screens make their submit handlers `async`, disable duplicate submission while pending, show the existing alert/status style on API failure, and navigate only after success.

- [ ] **Step 4: Run test and check no primary local keys remain**

Run: `node --test context/AuthContext.test.js; rg -n "registered-users|SCAN_HISTORY_STORAGE_KEY" context/AuthContext.js`

Expected: test PASS; only the explicit cache key remains.

### Task 8: Route scans, results, history, and map data through the API

**Files:**
- Modify: `services/waterAnalysisService.js`
- Modify: `components/CameraScanner/CameraView.js`
- Modify: `screens/History/HistoryScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/Map/MapScreen.native.js`
- Modify: `screens/Map/FullMapScreen.native.js`

- [ ] **Step 1: Write failing status-colour tests**

```js
test('marker colors match backend safety status', () => {
  assert.equal(markerColorFor('Safe'), '#22A06B');
  assert.equal(markerColorFor('Moderate'), '#D48A00');
  assert.equal(markerColorFor('Unsafe'), '#D92D20');
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `node --test services/apiClient.test.js`

Expected: FAIL because marker status mapping does not exist.

- [ ] **Step 3: Replace scan analysis delegation and map marker derivation**

```js
export async function analyzeDocument(input) {
  return toScanResult(await api.analyzeWater({
    imageUri: input.imageUri,
    userId: input.userId,
    gpsLatitude: input.location?.latitude,
    gpsLongitude: input.location?.longitude,
    barangay: input.barangay,
    municipality: input.municipality,
    capturedAt: input.capturedAt || new Date().toISOString(),
  }));
}
const pinColor = markerColorFor(scan.overallStatus || scan.status);
```

`CameraView` passes `currentUser` data to analysis and does not fabricate results. Results/history resolve by backend ID. Native marker callouts show user, barangay, municipality, pH, nitrate, copper, status, and tested date, then use the existing `Result` navigation on press.

- [ ] **Step 4: Run mapping tests and Expo static checks**

Run: `node --test services/apiClient.test.js; npm run web -- --help`

Expected: mapping tests PASS; Expo command starts without module-resolution errors.

### Task 9: Upgrade the existing PDF data contract and restore legacy file imports

**Files:**
- Modify: `services/exportService.js`
- Modify: `screens/Result/ResultScreen.js`
- Modify: `screens/History/HistoryDetailScreen.js`
- Modify: `context/AuthContext.js`
- Create: `services/exportService.test.js`

- [ ] **Step 1: Write a failing report-content test**

```js
test('buildPdfHtml includes public user data, strip image, chemistry, GPS and remarks', () => {
  const html = buildPdfHtml({ user, test });
  for (const expected of ['Ana Cruz', 'ana@example.test', '6.80', '3.50 mg/L', '0.600 mg/L', '14.6000', 'Safe', 'acceptable']) {
    assert.match(html, new RegExp(expected));
  }
  assert.match(html, /<img /);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `node --test services/exportService.test.js`

Expected: FAIL because the current report contains only generic summary fields.

- [ ] **Step 3: Build the report from backend-owned records**

```js
import * as FileSystem from 'expo-file-system/legacy';
export function buildPdfHtml({ user = {}, test = {} }) {
  return `<h1>AQUILITY Water Test Report</h1><h2>User information</h2><p>${escapeHtml(user.fullName)}</p><h2>Estimated results</h2><p>pH: ${escapeHtml(test.resultData.pH)}</p>`;
}
```

The complete template includes name, email, phone, barangay, municipality, tested date/time, latitude/longitude, captured strip image, pH/nitrate/copper/statuses, remarks, and a map-coordinate link. `ResultScreen` and `HistoryDetailScreen` pass the current profile with the selected backend test. Every legacy file operation imports `expo-file-system/legacy`; `rg` must find no runtime legacy method import from `expo-file-system`.

- [ ] **Step 4: Run test and import guard**

Run: `node --test services/exportService.test.js; rg -n "from 'expo-file-system'" context services`

Expected: report test PASS; zero direct main-module imports in runtime legacy paths.

### Task 10: Verify server, Expo build, and failure behavior

**Files:**
- Modify: `backend/README.md`
- Modify: `README.md`

- [ ] **Step 1: Run complete backend tests**

Run: `npm test`

Expected: all backend route, schema, authentication, analysis, and history tests PASS.

- [ ] **Step 2: Verify database migration and seed commands are documented**

Run: `rg -n "db:migrate|db:seed|DATABASE_URL|EXPO_PUBLIC_API_BASE_URL" backend/README.md README.md`

Expected: every command and required environment variable is present.

- [ ] **Step 3: Verify Expo builds**

Run: `npm run web -- --clear` and `npx expo export --platform android --clear`

Expected: web and Android bundles complete successfully.

- [ ] **Step 4: Verify backend-unavailable fallback manually**

Run the Expo app with an unreachable `EXPO_PUBLIC_API_BASE_URL`, open a previously cached session, and confirm profile/history render cached data with no false analysis values. Restore the real URL, refresh history, and confirm the cache is replaced with the API response.

## Plan self-review

Coverage: Tasks 1-5 implement the service, schema, users, credentials, uploads, mock engine, test results, GPS, and history APIs. Tasks 6-8 migrate all requested Expo data flows while preserving navigation and add marker status colours. Task 9 covers the complete PDF and legacy file-system regression. Task 10 verifies the backend, documentation, offline behavior, and Expo bundles.

Consistency: API fields use `overallStatus`, `resultData`, `gps`, and `analysisId` at the HTTP boundary; `apiMappers` is the only layer translating that contract into the existing screen structure. Password hashes never pass the auth service's public-user mapper.

No Git commit steps are included because the supplied `AQUILITY` directory has no Git repository metadata.
