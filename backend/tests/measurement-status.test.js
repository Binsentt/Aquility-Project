import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { classifyMeasurements } from '../services/measurementClassification.js';

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
