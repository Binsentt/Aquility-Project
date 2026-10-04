import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { estimatePHFromColor } from '../utils/phColorModel.js';

const calibration = JSON.parse(await readFile(
  new URL('../database/colorAnalysisCalibration.json', import.meta.url),
  'utf8',
));
const model = calibration.pH.continuousModel;

test('official-time pH model estimates only from a valid ROI RGB color and stays in verified support', () => {
  const result = estimatePHFromColor([186, 178, 142], model);

  assert.equal(result.accepted, true);
  assert.equal(result.modelVersion, model.version);
  assert.ok(result.value >= 7.22 && result.value <= 8.21);
  assert.ok(Array.isArray(result.lab));
});

test('different supported ROI colors with identical scan metadata produce different pH values', () => {
  const first = estimatePHFromColor([186, 178, 142], model);
  const second = estimatePHFromColor([186, 135, 104], model);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.notEqual(first.value, second.value);
});

test('extreme colors outside the official real-camera color domain are rejected', () => {
  const result = estimatePHFromColor([255, 0, 0], model);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'OUTSIDE_CALIBRATED_COLOR_DOMAIN');
  assert.equal(result.value, null);
});

test('invalid RGB measurements are rejected without manufacturing a pH value', () => {
  const result = estimatePHFromColor([NaN, 0, 0], model);

  assert.equal(result.accepted, false);
  assert.equal(result.status, 'INVALID_RGB');
  assert.equal(result.value, null);
});
