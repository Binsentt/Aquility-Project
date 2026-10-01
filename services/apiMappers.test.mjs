import test from 'node:test';
import assert from 'node:assert/strict';
import { markerColorFor, toScanResult } from './apiMappers.js';

const apiWaterTest = {
  analysisId: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
  userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  imagePath: '/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token',
  pH: 6.8,
  phStatus: 'Normal',
  nitrite: { value: 10, unit: 'ppm', status: 'Unvalidated', hue: 30 },
  overallStatus: 'Unvalidated',
  remarks: 'Client calibration output requires experimental validation.',
  gps: { latitude: 14.6, longitude: 120.98 },
  sampleClass: 'AA',
  siteName: 'Pawikan',
  sourceType: 'Coastal / Pawikan',
  barangay: 'San Isidro',
  municipality: 'Sample City',
  capturedAt: '2026-08-04T00:00:00.000Z',
  analyzedAt: '2026-08-04T00:01:00.000Z',
};

test('toScanResult maps API chemistry and GPS to the existing result screen contract', () => {
  const scan = toScanResult(apiWaterTest, 'http://localhost:4000');

  assert.equal(scan.id, apiWaterTest.analysisId);
  assert.equal(scan.scanStatus, 'Completed');
  assert.equal(scan.analysisStatus, 'Completed');
  assert.equal(scan.scientificStatus, 'Pending laboratory validation');
  assert.equal(scan.measuredParametersStatus, 'Not classified');
  assert.equal(scan.scientificValidationStatus, 'Pending laboratory validation');
  assert.deepEqual(scan.detectedParameters, ['pH', 'Nitrite']);
  assert.equal(scan.nitrite.hue, 30);
  assert.deepEqual(scan.location, { latitude: 14.6, longitude: 120.98 });
  assert.equal(scan.actualLatitude, 14.6);
  assert.equal(scan.actualLongitude, 120.98);
  assert.equal(scan.sampleClass, 'AA');
  assert.equal(scan.siteName, 'Pawikan');
  assert.equal(scan.sourceType, 'Coastal / Pawikan');
  assert.deepEqual(scan.resultData, {
    pH: '6.80',
    Nitrite: '10.00 ppm',
    'Measured Parameters Status': 'Not classified',
    'Scientific Validation': 'Pending laboratory validation',
  });
  assert.equal(scan.imageUri, 'http://localhost:4000/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token');
});

test('markerColorFor maps every backend safety class to a distinct map color', () => {
  assert.equal(markerColorFor('Safe'), '#22A06B');
  assert.equal(markerColorFor('Moderate'), '#D48A00');
  assert.equal(markerColorFor('Unsafe'), '#D92D20');
});

test('toScanResult does not invent a safety class when the backend has no classification', () => {
  const scan = toScanResult({
    analysisId: 'scan-without-classification',
    pH: 7,
    nitrite: { value: 10, unit: 'ppm' },
    overallStatus: null,
    measuredParametersStatus: 'Not classified',
    scientificValidationStatus: 'Pending laboratory validation',
  }, 'http://localhost:4000/api');

  assert.equal(scan.status, 'NOT CLASSIFIED');
  assert.equal(scan.overallStatus, 'NOT CLASSIFIED');
  assert.equal(scan.measuredParametersStatus, 'Not classified');
  assert.equal(scan.scientificValidationStatus, 'Pending laboratory validation');
});
