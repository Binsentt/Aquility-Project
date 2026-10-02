import test from 'node:test';
import assert from 'node:assert/strict';
import { filterValidMapMarkers, markerColorFor, safeMapFeed, toMapMarker, toScanResult } from './apiMappers.js';

const apiWaterTest = {
  analysisId: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
  userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  imagePath: '/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token',
  pH: 6.8,
  phStatus: 'Normal',
  nitrite: { value: 0.5, unit: 'ppm', status: 'Unvalidated', hue: 340, matchState: 'EXACT_OR_IN_RANGE', matchingMethod: 'direct-client-rgb-range' },
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
  assert.equal(scan.measuredParametersDisplayStatus, 'Awaiting approved limits');
  assert.equal(scan.scientificValidationStatus, 'Pending laboratory validation');
  assert.equal(scan.scientificValidationDisplayStatus, 'Pending laboratory comparison');
  assert.equal(scan.laboratoryComparisonStatus, 'Not entered yet');
  assert.deepEqual(scan.detectedParameters, ['pH', 'Nitrite']);
  assert.equal(scan.nitrite.hue, 340);
  assert.deepEqual(scan.location, { latitude: 14.6, longitude: 120.98 });
  assert.equal(scan.actualLatitude, 14.6);
  assert.equal(scan.actualLongitude, 120.98);
  assert.equal(scan.sampleClass, 'AA');
  assert.equal(scan.siteName, 'Pawikan');
  assert.equal(scan.sourceType, 'Coastal / Pawikan');
  assert.deepEqual(scan.resultData, {
    pH: '6.80',
    Nitrite: '0.50 ppm',
    'Measured Parameters Status': 'Awaiting approved limits',
    'Scientific Validation': 'Pending laboratory comparison',
  });
  assert.equal(scan.imageUri, 'http://localhost:4000/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token');
});

test('Result screen contract displays backend-returned pH and Nitrite values', () => {
  const scan = toScanResult({
    analysisId: 'backend-measured-values',
    pH: 7.25,
    nitrite: { value: 0.5, unit: 'ppm', status: 'Estimated' },
  }, 'https://aquality-api-production.up.railway.app/api');

  assert.equal(scan.resultData.pH, '7.25');
  assert.equal(scan.resultData.Nitrite, '0.50 ppm');
  assert.doesNotMatch(JSON.stringify(scan.resultData), /undefined|NaN|null ppm/);
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
    nitrite: { value: 0.5, unit: 'ppm' },
    overallStatus: null,
    measuredParametersStatus: 'Not classified',
    scientificValidationStatus: 'Pending laboratory validation',
  }, 'http://localhost:4000/api');

  assert.equal(scan.status, 'NOT CLASSIFIED');
  assert.equal(scan.overallStatus, 'NOT CLASSIFIED');
  assert.equal(scan.measuredParametersStatus, 'Not classified');
  assert.equal(scan.scientificValidationStatus, 'Pending laboratory validation');
  assert.equal(scan.measuredParametersDisplayStatus, 'Awaiting approved limits');
  assert.equal(scan.scientificValidationDisplayStatus, 'Pending laboratory comparison');
});

test('toScanResult labels laboratory comparison only when a lab value exists', () => {
  const scan = toScanResult({
    analysisId: 'scan-with-lab-value',
    labComparison: { pH: { labValue: 7.1 }, Nitrite: { labValue: null } },
  }, 'http://localhost:4000/api');

  assert.equal(scan.laboratoryComparisonStatus, 'Entered');
});

test('toScanResult keeps an unavailable Nitrite value unavailable', () => {
  const scan = toScanResult({
    analysisId: 'out-of-range-nitrite',
    pH: 7,
    nitrite: { value: null, unit: 'ppm', status: 'ABOVE_CALIBRATION_RANGE' },
  }, 'http://localhost:4000/api');

  assert.equal(scan.nitrite.value, null);
  assert.equal(scan.resultData.Nitrite, 'Unavailable');
});

test('toScanResult keeps both unavailable scientific values explicit', () => {
  const scan = toScanResult({
    analysisId: 'unavailable-analysis',
    pH: null,
    nitrite: { value: null, unit: 'ppm', status: 'NITRITE_OUTSIDE_CALIBRATION_RANGE' },
  }, 'http://localhost:4000/api');

  assert.equal(scan.pH, null);
  assert.equal(scan.nitrite.value, null);
  assert.equal(scan.resultData.pH, 'Unavailable');
  assert.equal(scan.resultData.Nitrite, 'Unavailable');
  assert.doesNotMatch(JSON.stringify(scan.resultData), /NaN|null ppm|undefined/);
});

test('map marker sanitizer filters invalid coordinates and unstable IDs', () => {
  const markers = filterValidMapMarkers([
    { id: 'valid', latitude: 14.6, longitude: 120.98, capturedAt: '2026-08-04T00:00:00.000Z' },
    { id: 'bad-latitude', latitude: 91, longitude: 120.98 },
    { id: 'bad-longitude', latitude: 14.6, longitude: -181 },
    { id: '', latitude: 14.6, longitude: 120.98 },
    { id: { unstable: true }, latitude: 14.6, longitude: 120.98 },
    null,
    { id: 'bad-date', latitude: 14.6, longitude: 120.98, capturedAt: 'not-a-date' },
  ]);

  assert.equal(markers.length, 2);
  assert.equal(markers[0].id, 'valid');
  assert.deepEqual(markers[0].coordinate, { latitude: 14.6, longitude: 120.98 });
  assert.equal(markers[0].createdAt, '2026-08-04T00:00:00.000Z');
  assert.equal(markers[1].createdAt, null);
});

test('map API failure and location denial resolve to safe empty values', () => {
  assert.deepEqual(safeMapFeed(null), []);
  assert.deepEqual(safeMapFeed({ items: null }), []);
  assert.equal(toMapMarker({ id: 'no-location', latitude: null, longitude: null }), null);
});

test('map sanitizer handles zero, one, and many valid markers', () => {
  assert.deepEqual(filterValidMapMarkers([]), []);
  assert.equal(filterValidMapMarkers([{ id: 'one', latitude: 0, longitude: 0 }]).length, 1);
  assert.equal(filterValidMapMarkers([
    { id: 'one', latitude: 1, longitude: 1 },
    { id: 'two', latitude: 2, longitude: 2 },
    { id: 'three', latitude: 3, longitude: 3 },
  ]).length, 3);
});
