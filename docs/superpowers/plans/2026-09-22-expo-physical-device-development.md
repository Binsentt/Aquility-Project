# Expo Physical-Device Development Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make physical-device Expo Go development use a documented LAN API override while preserving the localhost web fallback.

**Architecture:** Keep `services/apiClient.js` unchanged as the single API endpoint consumer. Developers create an ignored root `.env` with `EXPO_PUBLIC_API_BASE_URL=http://<laptop-lan-ip>:4000/api`; `.env.example` and setup documentation explain the workflow. Expo CLI remains responsible for Metro host selection, and the backend keeps its existing development bind of `0.0.0.0:4000`.

**Tech Stack:** Expo SDK 54, React Native 0.81, Metro, Node.js/Express backend, dotenv-style Expo environment variables, PowerShell validation.

---

### Task 1: Update the root Expo environment template

**Files:**
- Modify: `C:\Users\vince\Documents\Aquality System\AQUILITY\.env.example`
- Verify: `C:\Users\vince\Documents\Aquality System\AQUILITY\.gitignore`

- [ ] **Step 1: Confirm the root environment file is ignored**

Run from `C:\Users\vince\Documents\Aquality System\AQUILITY`:

```powershell
git check-ignore -v .env
```

Expected: a matching `.gitignore` rule is printed. Do not create or stage a real root `.env` in this change.

- [ ] **Step 2: Keep the existing web default and clarify device overrides**

Update `.env.example` so it contains:

```env
# Laptop web development
# EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api

# Android emulator
# EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api

# Physical Android or iOS device on the same Wi-Fi as the laptop
# EXPO_PUBLIC_API_BASE_URL=http://<laptop-lan-ip>:4000/api

EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Do not place database URLs, database passwords, JWT secrets, or a real LAN IP in this file.

- [ ] **Step 3: Verify no secret or personal address was added**

Run:

```powershell
git diff -- .env.example
```

Expected: only comments and the existing safe localhost default change.

### Task 2: Document physical-device setup

**Files:**
- Modify: `C:\Users\vince\Documents\Aquality System\AQUILITY\README.md`
- Modify: `C:\Users\vince\Documents\Aquality System\AQUILITY\docs\DEPLOYMENT.md`

- [ ] **Step 1: Add a local development section to the project README**

Document these commands and rules:

```powershell
cd C:\Users\vince\Documents\Aquality System\AQUILITY
npm install
Copy-Item .env.example .env
ipconfig
# Edit .env and set EXPO_PUBLIC_API_BASE_URL=http://<Wi-Fi IPv4 address>:4000/api

cd backend
npm install
npm run db:migrate
npm start
```

Then document, from a second terminal at the project root:

```powershell
npx expo start --lan --clear
```

State that the phone and laptop must use the same Wi-Fi, the scanned Expo Go link must not use `127.0.0.1`, and `http://<laptop-ip>:4000/api/health` should be tested in the phone browser before troubleshooting login.

- [ ] **Step 2: Align deployment documentation with the same workflow**

In `docs/DEPLOYMENT.md`, keep the existing localhost fallback and add the exact root `.env` LAN override, Expo LAN command, Windows firewall/private-network guidance, and tunnel fallback:

```powershell
npx expo start --lan --clear
npx expo start --tunnel --clear
```

Explicitly state that `EXPO_PUBLIC_*` values are client-visible and must contain only the non-secret API URL.

- [ ] **Step 3: Review documentation scope**

Run:

```powershell
git diff -- README.md docs/DEPLOYMENT.md
```

Expected: only physical-device setup and networking guidance is added; backend architecture and database instructions remain unchanged.

### Task 3: Validate Expo and backend connectivity

**Files:**
- Verify: `C:\Users\vince\Documents\Aquality System\AQUILITY\app.json`
- Verify: `C:\Users\vince\Documents\Aquality System\AQUILITY\package.json`
- Verify: `C:\Users\vince\Documents\Aquality System\AQUILITY\services\apiClient.js`
- Verify: `C:\Users\vince\Documents\Aquality System\AQUILITY\backend\config\env.js`

- [ ] **Step 1: Run Expo diagnostics**

```powershell
npm ls expo react-native react react-dom --depth=0
npx expo-doctor
npx expo config --json
```

Expected: Expo SDK 54 resolves, Expo Doctor reports no issues, and the config resolves to the existing AQUALITY app.

- [ ] **Step 2: Start Metro in LAN mode**

```powershell
npx expo start --lan --clear
```

Confirm the Metro process listens on a reachable LAN interface and that its generated QR/deep link does not use `exp://127.0.0.1:8081`.

- [ ] **Step 3: Verify the backend bind and health endpoint**

In `backend`, with the existing private `backend/.env` and PostgreSQL available:

```powershell
npm start
```

Confirm startup logs show `0.0.0.0:4000`, then test:

```powershell
curl.exe http://127.0.0.1:4000/api/health
curl.exe http://<laptop-lan-ip>:4000/api/health
```

Expected: both requests return the existing health response when PostgreSQL is available.

- [ ] **Step 4: Run existing tests**

```powershell
cd backend
npm test
cd ..
node --test services/apiClient.test.mjs services/apiMappers.test.mjs services/reportTemplate.test.mjs
```

Expected: all existing selected tests pass.

- [ ] **Step 5: Verify web mode and whitespace**

```powershell
npm run web
git diff --check
```

Expected: Expo web starts without an API configuration error and `git diff --check` reports no whitespace errors.

### Task 4: Final scope review

**Files:**
- Review: all modified and untracked files from `git status --short`

- [ ] **Step 1: Confirm only intended files changed**

Run:

```powershell
git status --short
git diff --name-only
git ls-files --error-unmatch .env
```

Expected: `.env` is not tracked, no backend `.env` is staged, and only `.env.example`, README/deployment documentation, and the two design artifacts are part of this work.

- [ ] **Step 2: Confirm no hardcoded personal IP or secrets**

Run:

```powershell
rg -n "EXPO_PUBLIC_API_BASE_URL|DATABASE_URL|JWT_SECRET|192\.168\.|10\.0\.|127\.0\.0\.1" .env.example README.md docs/DEPLOYMENT.md
```

Expected: only placeholders, localhost defaults, and explanatory examples appear; no real LAN address or secret is added.

- [ ] **Step 3: Do not commit or push**

Leave the verified changes in the working tree. No `git commit`, `git push`, or deployment command is part of this plan.
