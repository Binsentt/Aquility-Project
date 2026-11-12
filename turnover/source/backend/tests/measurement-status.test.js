import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { classifyMeasurements, classifyNitriteStatus } from '../services/measurementClassification.js';

test('classification remains not classified when approved thresholds are absent', () => {
  assert.deepEqual(classifyMeasurements({ pH: 8, nitrite: 100, thresholds: null }), {
    status: 'Not classified',
    reason: 'NITRITE / OVERALL CLASSIFICATION RULE REQUIRED',
  });
});

test('active production calibration keeps centralized classification thresholds null', async () => {
  const calibration = JSON.parse(await readFile(fileURLToPath(new URL('../database/colorAnalysisCalibration.json', import.meta.url)), 'utf8'));
  assert.equal(calibration.thresholds, null);
  assert.equal(classifyMeasurements({ pH: 7, nitrite: 0.5, thresholds: calibration.thresholds }).status, 'Not classified');
});

test('classification evaluates only an explicitly supplied approved threshold set', () => {
  assert.deepEqual(classifyMeasurements({
    pH: 7,
    nitrite: 5,
    thresholds: { pH: { min: 6.5, max: 8.5 }, nitrite: { max: 10 } },
  }), {
    status: 'Within configured limits',
    reason: null,
  });

  assert.deepEqual(classifyMeasurements({
    pH: 9,
    nitrite: 5,
    thresholds: { pH: { min: 6.5, max: 8.5 }, nitrite: { max: 10 } },
  }), {
    status: 'Outside configured limits',
    reason: null,
  });
});

test('client-approved Nitrite boundaries classify exact 0, 0.5, and 1 ppm readings', () => {
  assert.equal(classifyNitriteStatus(0), 'Safe');
  assert.equal(classifyNitriteStatus(0.499), 'Safe');
  assert.equal(classifyNitriteStatus(0.5), 'Warning');
  assert.equal(classifyNitriteStatus(0.999), 'Warning');
  assert.equal(classifyNitriteStatus(1), 'Dangerous');
  assert.equal(classifyNitriteStatus(1.25), 'Dangerous');
});

test('qualified Nitrite above 1 ppm is Dangerous without inventing an exact concentration', () => {
  assert.equal(classifyNitriteStatus({ value: null, qualifier: '>', lowerBound: 1 }), 'Dangerous');
});

test('Nitrite with no valid concentration or qualifier has no status classification', () => {
  for (const result of [null, NaN, Infinity, -0.01, { value: null }, { value: null, qualifier: '>', lowerBound: 0.9 }]) {
    assert.equal(classifyNitriteStatus(result), null);
  }
});
