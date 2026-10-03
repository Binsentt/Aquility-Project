import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import appConfig from '../app.json' with { type: 'json' };
import easConfig from '../eas.json' with { type: 'json' };
import packageJson from '../package.json' with { type: 'json' };

const mapScreen = readFileSync(new URL('../screens/Map/MapScreen.native.js', import.meta.url), 'utf8');
const fullMapScreen = readFileSync(new URL('../screens/Map/FullMapScreen.native.js', import.meta.url), 'utf8');
const mainTabs = readFileSync(new URL('../navigation/MainTabs.js', import.meta.url), 'utf8');
const appNavigator = readFileSync(new URL('../navigation/AppNavigator.js', import.meta.url), 'utf8');

test('Expo config installs MapLibre plugin while preserving AQUALITY app identity and removing Google key configuration', () => {
  assert.ok(appConfig.expo.plugins.includes('@maplibre/maplibre-react-native'));
  assert.equal(appConfig.expo.name, 'AQUALITY');
  assert.equal(appConfig.expo.slug, 'AQUILITY');
  assert.equal(appConfig.expo.owner, 'binsenttiii');
  assert.equal(appConfig.expo.android.package, 'com.aquility.app');
  assert.equal(appConfig.expo.extra.eas.projectId, 'a2918d6a-9410-4a81-9a63-0320fae44fe6');
  assert.equal(packageJson.dependencies['@maplibre/maplibre-react-native'] != null, true);
  assert.equal(packageJson.dependencies['react-native-maps'], undefined);
  assert.equal(existsSync(new URL('../app.config.js', import.meta.url)), false);
  assert.doesNotMatch(JSON.stringify(appConfig.expo), /googleMaps|GOOGLE_MAPS_ANDROID_API_KEY/i);
  assert.equal(Object.hasOwn(easConfig.build?.preview?.env || {}, 'GOOGLE_MAPS_ANDROID_API_KEY'), false);
});

test('Map and Full Map keep MapLibre rendering and Map -> Full Map -> Back navigation contracts', () => {
  for (const screen of [mapScreen, fullMapScreen]) {
    assert.match(screen, /MapLibreWaterMap/);
    assert.doesNotMatch(screen, /react-native-maps|PROVIDER_GOOGLE|MapView/);
    assert.match(screen, /api\.listMapMarkers\(\)/);
  }
  assert.match(mapScreen, /navigation\.navigate\('FullMap'\)/);
  assert.match(fullMapScreen, /navigation\.goBack\(\)/);
  assert.match(mainTabs, /name="Map" component=\{MapScreen\}/);
  assert.match(appNavigator, /name="FullMap" component=\{FullMapScreen\}/);
  assert.match(mapScreen, /mapFeed \?\? \[\]/);
  assert.match(fullMapScreen, /mapFeed \?\? \[\]/);
  assert.match(mapScreen, /loading saved test locations/i);
  assert.match(fullMapScreen, /loading saved test locations/i);
  assert.match(mapScreen, /return\s*\(\)\s*=>\s*\{\s*isMounted\s*=\s*false/s);
  assert.match(fullMapScreen, /return\s*\(\)\s*=>\s*\{\s*isMounted\s*=\s*false/s);
  assert.doesNotMatch(mapScreen, /mapMarkersFromHistory\(scanHistory\),\s*\[mapFeed/);
  assert.doesNotMatch(fullMapScreen, /mapMarkersFromHistory\(scanHistory\),\s*\[mapFeed/);
});

test('shared MapLibre renderer provides safe load failure and retry behavior', () => {
  const mapRenderer = readFileSync(new URL('../components/MapLibreWaterMap.native.js', import.meta.url), 'utf8');
  assert.match(mapRenderer, /onDidFailLoadingMap/);
  assert.match(mapRenderer, /onDidFinishRenderingMapFully/);
  assert.match(mapRenderer, /mapLoadMessage\('failed'\)/);
  assert.match(mapRenderer, /Map unavailable/);
  assert.match(mapRenderer, /Try again/);
  assert.match(mapRenderer, /OPENFREEMAP_LIBERTY_STYLE/);
  assert.match(mapRenderer, /MAP_LOAD_TIMEOUT_MS/);
  assert.match(mapRenderer, /dispatchMapState\('retry'\)/);
});
