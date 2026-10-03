import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import appJson from '../app.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const appConfig = require('../app.config.js');

test('Google Maps key is injected from the build environment while preserving Expo identity and settings', () => {
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const testOnlyKey = 'test-only-google-maps-key';
  process.env.GOOGLE_MAPS_ANDROID_API_KEY = testOnlyKey;
  try {
    const resolved = appConfig({ config: appJson.expo });
    assert.equal(resolved.android.config.googleMaps.apiKey, testOnlyKey);
    assert.equal(resolved.name, 'AQUALITY');
    assert.equal(resolved.slug, 'AQUILITY');
    assert.equal(resolved.owner, 'binsenttiii');
    assert.equal(resolved.android.package, 'com.aquility.app');
    assert.equal(resolved.extra.eas.projectId, 'a2918d6a-9410-4a81-9a63-0320fae44fe6');
    assert.deepEqual(resolved.plugins, appJson.expo.plugins);
    assert.deepEqual(resolved.ios, appJson.expo.ios);
    assert.deepEqual(resolved.android.permissions, appJson.expo.android.permissions);
  } finally {
    if (previousKey == null) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
  }
});

test('missing Google Maps build key leaves Expo app configuration unchanged without inventing a key', () => {
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  try {
    const resolved = appConfig({ config: appJson.expo });
    assert.deepEqual(resolved, appJson.expo);
    assert.equal(resolved.android.config?.googleMaps?.apiKey, undefined);
  } finally {
    if (previousKey == null) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
  }
});
