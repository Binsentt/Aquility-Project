import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cameraSource = readFileSync(new URL('../components/CameraScanner/CameraView.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('./apiClient.js', import.meta.url), 'utf8');

test('development scanner diagnostics expose the exact prepared upload metadata', () => {
  assert.match(cameraSource, /Share exact upload image/);
  assert.match(cameraSource, /preparedUploadsRef/);
  assert.match(cameraSource, /pixelWidth/);
  assert.match(cameraSource, /pixelHeight/);
  assert.match(cameraSource, /sha256/);
});

test('multipart API debug output includes safe request and registration diagnostics', () => {
  assert.match(apiSource, /requestId: error\?\.requestId/);
  assert.match(apiSource, /registrationFailureCode: error\?\.registrationFailureCode/);
});
