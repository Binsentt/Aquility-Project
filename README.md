# 💧 AQUALITY

AQUALITY is a smartphone application that works with Microfluidic Paper-based Analytical Devices (µPADs) to help users test water quality quickly and easily. By scanning a colorimetric µPAD with a smartphone camera, the app estimates the pH and nitrate levels of a water sample, displays a simple water-quality assessment, and records the test location through GPS and GIS mapping.

It is designed as a simple, portable, and low-cost monitoring tool for students, researchers, and communities.

---

## 📱 Features

- Water quality testing records
- Test history and monitoring
- User authentication
- Secure data management
- Mobile-friendly interface
- Fast and responsive performance

---

## 🛠️ Tech Stack

### Mobile
- React Native
- Expo

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL

### Tools
- Git
- GitHub
- VS Code

---

## 🚀 Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/Aquality.git
```

### Install dependencies

```bash
npm install
```

or

```bash
pnpm install
```

### Start the application

```bash
npx expo start
```

### Physical-device development with Expo Go

For laptop web development, the default API URL is `http://localhost:4000/api`.
For a physical Android or iOS device, create the ignored root `.env` file and
replace the placeholder with the laptop's Wi-Fi IPv4 address:

```powershell
cd C:\Users\vince\Documents\Aquality System\AQUILITY
Copy-Item .env.example .env
ipconfig
# Edit .env:
# EXPO_PUBLIC_API_BASE_URL=http://<laptop-lan-ip>:4000/api
```

The `EXPO_PUBLIC_*` value is included in the client bundle, so it must contain
only the non-secret API URL. Never put PostgreSQL or JWT credentials in the
root `.env`.

Start the backend in one terminal:

```powershell
cd backend
npm install
npm run db:migrate
npm start
```

The development backend listens on `0.0.0.0:4000`. In a second terminal at the
project root, start Expo Go in LAN mode:

```powershell
npx expo start --lan --clear
```

Keep the phone and laptop on the same Wi-Fi network. Scan the Expo Go QR code
with the physical Android or iOS device; the link must not use
`exp://127.0.0.1:8081`. Before troubleshooting login, open
`http://<laptop-lan-ip>:4000/api/health` in the phone browser. If it does not
load, check the backend process, Windows Firewall permission for private
networks, and Wi-Fi client isolation.

If LAN mode is unavailable, use Expo's tunnel fallback:

```powershell
npx expo start --tunnel --clear
```

---

## 📂 Project Structure

```
Aquality
│
├── assets
├── components
├── screens
├── navigation
├── services
├── hooks
├── utils
└── App.js
```

---

## 👨‍💻 Developers

- Vincent Angelo D. Tafalla

---

## 📄 License

This project is intended for educational and portfolio purposes.
