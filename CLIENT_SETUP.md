# AQUALITY Client Setup

This guide starts the local PostgreSQL API and either the browser app or Expo Go app. It does not deploy anything. pH and Nitrite calculations are software estimates from the supplied calibration data, not scientifically validated water-safety results.

## Prerequisites

1. Install Node.js LTS and PostgreSQL.
2. Open the project folder in VS Code and use a PowerShell terminal at the project root.
3. Create a PostgreSQL user and database named `aquality`. For example, from `psql` as a PostgreSQL administrator:

```sql
CREATE USER aquality_user WITH PASSWORD 'choose-a-private-password';
CREATE DATABASE aquality OWNER aquality_user;
```

Keep the password private. If the database already exists, do not drop or recreate it.

## Configure and Initialize

From the project root, install the Expo app dependencies and make the backend environment file:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` locally. Set `DATABASE_URL` to the PostgreSQL username, private password, host, port, and database you created, for example `postgresql://aquality_user:YOUR_PRIVATE_PASSWORD@localhost:5432/aquality`. Keep `DATABASE_SSL=false` for a local PostgreSQL server. Set `JWT_SECRET` to a private random value of at least 32 characters. Never put these values in the root Expo `.env` or commit either `.env` file.

Install backend dependencies and initialize the schema. These migrations are recorded by filename and can safely be rerun:

```powershell
Set-Location backend
npm install
npm run db:migrate
npm run db:seed
Set-Location ..
```

The seed command validates the checked-in calibration JSON; it does not insert sample accounts or fake water-test records.

## Daily Start Procedure

Terminal 1, from the project root:

```powershell
Set-Location backend
npm start
```

Wait for the API startup message. Verify `http://localhost:4000/api/health` reports a connected database.

Terminal 2, for browser testing, from the project root:

```powershell
npm run web
```

Open the local URL printed by Expo. Use the browser flow to register or log in, capture/import an image, inspect the result, open History and a history detail, and export the report.

Terminal 2 instead, for physical-device testing, create the ignored root `.env` from `.env.example` and set `EXPO_PUBLIC_API_BASE_URL=http://<COMPUTER_LAN_IPV4>:4000/api`. Find the computer's Wi-Fi IPv4 address with `ipconfig`. Then run:

```powershell
npx expo start --lan --clear
```

Scan the displayed QR code with Expo Go. The phone and computer must be on the same Wi-Fi network. The Expo link must use a reachable LAN host and must not resolve to `127.0.0.1`; that address refers to the phone itself. The API URL in the root `.env` must also use the computer's reachable LAN address. Do not hardcode a developer or client IP in application source.

Web and Expo Go are separate testing modes; run one Expo command at a time. The backend remains running in Terminal 1. If a third terminal is preferred, use it for Expo and leave Terminal 2 available for logs or database inspection.

## Login and Persistence Check

Register a client-owned test account in the app, or use an existing authorized account. Log in, submit an image analysis, then verify the new result is shown in History and opens in history detail. Export its report. Log out, log in again, and verify that the saved record remains available. Do not share test credentials or use them as production defaults.

## Troubleshooting

- If PostgreSQL is unavailable, confirm its Windows service is running, `DATABASE_URL` is correct, and `npm run db:migrate` completed from `backend`.
- If the health URL works on the computer but not the phone, check that both devices share Wi-Fi, use the computer's current private IPv4 address, and allow Node.js/port 4000 through Windows Firewall on the private network only. Check for Wi-Fi client isolation.
- If Expo LAN discovery is blocked, try `npx expo start --tunnel --clear` for Metro connectivity. The backend API still needs a URL reachable by the phone; a Metro tunnel does not automatically tunnel the local API.
- If login or upload fails, check the API URL, backend terminal, health endpoint, and the API error message. Do not disable authentication to work around a setup problem.
- Unsupported or damaged images are rejected; choose a valid JPEG, PNG, or WebP under the upload size limit.

## Shutdown and Restart

Stop each running process with `Ctrl+C` in its own terminal. Restart PostgreSQL if needed, then start Terminal 1 (`Set-Location backend; npm start`) before the web or Expo command. Migrations need to be rerun only after pulling code that adds a new migration.