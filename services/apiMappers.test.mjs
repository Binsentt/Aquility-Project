import test from 'node:test';
import assert from 'node:assert/strict';
import { markerColorFor, toScanResult } from './apiMappers.js';

const apiWaterTest = {
  analysisId: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
  userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  imagePath: '/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token',
  pH: 6.8,
  phStatus: 'Normal',
  nitrate: { value: 3.5, unit: 'mg/L', status: 'Safe' },
  copper: { value: 0.6, unit: 'mg/L', status: 'Safe' },
  overallStatus: 'Safe',
  remarks: 'Water quality appears acceptable based on the current estimated values.',
  gps: { latitude: 14.6, longitude: 120.98 },
  barangay: 'San Isidro',
  municipality: 'Sample City',
  capturedAt: '2026-08-04T00:00:00.000Z',
  analyzedAt: '2026-08-04T00:01:00.000Z',
};

test('toScanResult maps API chemistry and GPS to the existing result screen contract', () => {
  const scan = toScanResult(apiWaterTest, 'http://localhost:4000');

  assert.equal(scan.id, apiWaterTest.analysisId);
  assert.deepEqual(scan.location, { latitude: 14.6, longitude: 120.98 });
  assert.deepEqual(scan.resultData, {
    pH: '6.80',
    Nitrate: '3.50 mg/L',
    'Copper (Cu²⁺)': '0.600 mg/L',
    'Overall Status': 'Safe',
  });
  assert.equal(scan.imageUri, 'http://localhost:4000/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token');
});

test('markerColorFor maps every backend safety class to a distinct map color', () => {
  assert.equal(markerColorFor('Safe'), '#22A06B');
  assert.equal(markerColorFor('Moderate'), '#D48A00');
  assert.equal(markerColorFor('Unsafe'), '#D92D20');
});
