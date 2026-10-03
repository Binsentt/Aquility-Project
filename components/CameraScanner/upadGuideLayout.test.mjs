import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const UPAD_GUIDE_LANDMARKS = JSON.parse(await readFile(new URL('./upadGuideLayout.json', import.meta.url), 'utf8'));

test('soft capture guide shows body landmarks in canonical order without imposing alignment dimensions', () => {
  assert.deepEqual(UPAD_GUIDE_LANDMARKS.map(({ id }) => id), ['square', 'nitrite', 'ph', 'triangle']);
  assert.ok(UPAD_GUIDE_LANDMARKS.every(({ x, y, kind }) => (
    Number.isFinite(x) && x > 0 && x < 1 && Number.isFinite(y) && y > 0 && y < 1
      && ['fiducial', 'sensing-zone'].includes(kind)
  )));
  assert.equal(UPAD_GUIDE_LANDMARKS.find(({ id }) => id === 'square').kind, 'fiducial');
  assert.equal(UPAD_GUIDE_LANDMARKS.find(({ id }) => id === 'triangle').kind, 'fiducial');
  assert.deepEqual(UPAD_GUIDE_LANDMARKS.map(({ x }) => x), [0.08, 0.21, 0.41, 0.53]);
  assert.equal(UPAD_GUIDE_LANDMARKS.find(({ id }) => id === 'nitrite').label, 'Nitrite');
  assert.equal(UPAD_GUIDE_LANDMARKS.find(({ id }) => id === 'ph').label, 'pH');
});

test('camera overlay draws a soft µPAD silhouette with a tapered shoulder and narrow handle only', async () => {
  const source = await readFile(new URL('./ScannerOverlay.js', import.meta.url), 'utf8');
  assert.match(source, /pointerEvents="none"/);
  assert.match(source, /UPAD_GUIDE_LANDMARKS\.map/);
  assert.match(source, /padSilhouette/);
  assert.match(source, /styles\.padBody/);
  assert.match(source, /styles\.padTaper/);
  assert.match(source, /styles\.padHandle/);
  assert.doesNotMatch(source, /onPress|registration|ROI|detector/i);
});
