import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authContext = readFileSync(new URL('../context/AuthContext.js', import.meta.url), 'utf8');
const settingsScreen = readFileSync(new URL('../screens/Settings/SettingsScreen.js', import.meta.url), 'utf8');
const historyDetail = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');
const splashScreen = readFileSync(new URL('../screens/Splash/SplashScreen.js', import.meta.url), 'utf8');
const cameraView = readFileSync(new URL('../components/CameraScanner/CameraView.js', import.meta.url), 'utf8');
const mapScreen = readFileSync(new URL('../screens/Map/MapScreen.native.js', import.meta.url), 'utf8');
const fullMapScreen = readFileSync(new URL('../screens/Map/FullMapScreen.native.js', import.meta.url), 'utf8');
const applicationSettings = readFileSync(new URL('../screens/Settings/ApplicationSettings.js', import.meta.url), 'utf8');
const profileScreen = readFileSync(new URL('../screens/Profile/ProfileScreen.js', import.meta.url), 'utf8');
const loginScreen = readFileSync(new URL('../screens/Login/LoginScreen.js', import.meta.url), 'utf8');
const privacyNotice = readFileSync(new URL('../screens/Settings/PrivacyNoticeScreen.js', import.meta.url), 'utf8');
const helpGuide = readFileSync(new URL('../screens/Settings/HelpGuideScreen.js', import.meta.url), 'utf8');
const homeScreen = readFileSync(new URL('../screens/Home/HomeScreen.js', import.meta.url), 'utf8');
const profileSettings = readFileSync(new URL('../screens/Settings/ProfileSettings.js', import.meta.url), 'utf8');
const historyScreen = readFileSync(new URL('../screens/History/HistoryScreen.js', import.meta.url), 'utf8');

test('the account context clears the authenticated session only after the backend confirms account deletion', () => {
  assert.match(authContext, /api\.deleteAccount/);
  assert.match(authContext, /await clearSession\(\)/);
  assert.match(authContext, /resetToWelcome\(\)/);
});

test('Settings presents a destructive password-confirmed account deletion flow', () => {
  assert.match(settingsScreen, /Account Management/);
  assert.match(settingsScreen, /Delete Account/);
  assert.match(settingsScreen, /Delete Permanently/);
  assert.match(settingsScreen, /Are you sure you want to permanently delete your account\?/);
  assert.match(settingsScreen, /secureTextEntry/);
});

test('History presents a destructive confirmation before deleting a scan result', () => {
  assert.match(historyDetail, /Delete Scan Result/);
  assert.match(historyDetail, /Are you sure you want to permanently delete this scan result\?/);
  assert.match(historyDetail, /Delete Permanently/);
});

test('Splash waits for session restoration and returns authenticated users to the app', () => {
  assert.match(splashScreen, /useAuth/);
  assert.match(splashScreen, /authLoaded/);
  assert.match(splashScreen, /currentUser/);
  assert.match(splashScreen, /currentUser\?\.id \? 'MainTabs' : 'Welcome'/);
});

test('camera capture has a lock so rapid taps cannot create duplicate captures', () => {
  assert.match(cameraView, /captureLockRef/);
  assert.match(cameraView, /captureLockRef\.current = true/);
  assert.match(cameraView, /captureLockRef\.current = false/);
});

test('native map and application permission effects ignore late async results after unmount', () => {
  assert.match(mapScreen, /let isMounted = true/);
  assert.match(mapScreen, /if \(isMounted\) setMapFeed/);
  assert.match(fullMapScreen, /let isMounted = true/);
  assert.match(fullMapScreen, /if \(isMounted\) setMapFeed/);
  assert.match(applicationSettings, /let isMounted = true/);
  assert.match(applicationSettings, /if \(isMounted\) \{\s*setCameraStatus[\s\S]*setPhotoStatus/);
});

test('logout and destructive dialog cleanup are awaited without duplicate navigation', () => {
  assert.match(profileScreen, /await logout\(\)/);
  assert.doesNotMatch(profileScreen, /navigation\.navigate\('Welcome'\)/);
  assert.match(settingsScreen, /setConfirmVisible\(false\);\s*setConfirmType\(''\);[\s\S]*?await logout\(\)/);
});

test('visible account and application actions are backed by an implemented flow', () => {
  assert.doesNotMatch(loginScreen, /Forgot Password\?/);
  assert.doesNotMatch(applicationSettings, /Cache cleared successfully/);
  assert.doesNotMatch(applicationSettings, /Local app data has been reset/);
});

test('privacy and help text describe the implemented backend workflow without placeholders', () => {
  assert.match(privacyNotice, /AQUILITY service/);
  assert.doesNotMatch(privacyNotice, /current local session/);
  assert.doesNotMatch(privacyNotice, /project\u2019s existing support channel/);
  assert.doesNotMatch(helpGuide, /tap a marker to open the matching result/);
});

test('home and profile controls do not render navigation or account actions without a working flow', () => {
  assert.match(homeScreen, /onPress=\{\(\) => navigation\.navigate\('History'\)\}/);
  assert.doesNotMatch(profileSettings, /Change Password/);
});

test('client fallback paths do not emit production console diagnostics', () => {
  assert.doesNotMatch(authContext, /console\./);
  assert.doesNotMatch(historyScreen, /console\./);
});
