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
