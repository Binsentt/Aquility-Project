# Expo Physical-Device Development Configuration

## Goal

Allow the existing AQUALITY Expo Go app to load on physical Android and iOS devices and reach the development backend over the local network, without changing the application architecture or hardcoding a developer's IP address.

## Design

The root Expo project will continue to use `EXPO_PUBLIC_API_BASE_URL` as the single API endpoint source. Laptop/web development keeps the existing `http://localhost:4000/api` default. Physical-device development is configured by creating an ignored root `.env` file with:

```env
EXPO_PUBLIC_API_BASE_URL=http://<laptop-lan-ip>:4000/api
```

The checked-in `.env.example` and relevant setup documentation will explain how to find the laptop LAN IPv4 address, configure the URL, and keep the phone and laptop on the same network. No database credentials or backend secrets will be placed in the Expo environment.

Expo/Metro host selection remains the responsibility of the Expo CLI. The documented physical-device command is `npx expo start --lan --clear`; tunnel mode remains an optional fallback when LAN access is unavailable. No custom Metro host, runtime IP detection, or backend architecture change will be added.

## Backend and security

The backend development default remains `0.0.0.0:4000`, allowing LAN clients to connect while preserving the existing production behavior. The root `.env` remains ignored by Git. The backend `.env` remains separate and continues to hold database and JWT configuration only on the server.

## Verification

Verification will include:

- checking Git ignore rules and confirming no root `.env` or backend secrets are staged;
- validating the resolved Expo configuration and dependency compatibility;
- starting Metro in LAN mode and confirming it is reachable through the laptop LAN address;
- starting the backend and checking `/api/health` locally and through the LAN address when the database is available;
- running existing backend and frontend service tests;
- verifying `npm run web` still starts successfully;
- running `git diff --check`.

