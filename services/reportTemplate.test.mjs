import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfHtml } from './reportTemplate.js';

test('buildPdfHtml renders the AQUALITY mark only when a resolved brand image is supplied', () => {
  const branded = buildPdfHtml({ brandImageUri: 'data:image/png;base64,brand' });
  const fallback = buildPdfHtml();

  assert.match(branded, /data-brand-logo="aquality"/);
  assert.match(branded, /data:image\/png;base64,brand/);
  assert.doesNotMatch(fallback, /data-brand-logo="aquality"/);
  assert.match(fallback, /AQUALITY Water Test Report/);
});

test('buildPdfHtml includes public user data, strip image, chemistry, GPS, status, and remarks', () => {
  const html = buildPdfHtml({
    user: {
      fullName: 'Ana Cruz',
      email: 'ana@example.test',
      phoneNumber: '09171234567',
      barangay: 'San Isidro',
      municipality: 'Sample City',
    },
    test: {
      imageUri: 'https://api.example.test/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=short-lived-token',
      createdAt: '2026-08-04T00:00:00.000Z',
      location: { latitude: 14.6, longitude: 120.98 },
      sampleClass: 'AA',
      siteName: 'Pawikan',
      sourceType: 'Coastal / Pawikan',
      resultData: {
        pH: '6.80',
        'pH Category': 'Acidic',
        Nitrite: '0.50 ppm',
      },
      overallStatus: 'NOT CLASSIFIED',
      measuredParametersStatus: 'Not classified',
      remarks: 'Water quality appears acceptable based on the current estimated values.',
    },
  });

  for (const expected of ['Ana Cruz', 'ana@example.test', '09171234567', 'San Isidro', '6.80', '0.50 ppm', 'Nitrite:', '14.6000', 'SA', 'Pawikan', 'Coastal / Pawikan', 'Not classified', 'acceptable']) {
    assert.match(html, new RegExp(expected));
  }
  assert.match(html, /Measured Parameters Status/);
  assert.match(html, /pH Category:<\/strong> Acidic/);
  assert.doesNotMatch(html, /Scientific Validation|Laboratory Comparison|Pending laboratory/i);
  assert.match(html, /<img /);
  assert.match(html, /water-tests\/3ec25331-d511-491f-a1b6-11670bc4a2d6\/image\?token=short-lived-token/);
  assert.match(html, /google\.com\/maps/);
  assert.doesNotMatch(html, /Copper|Cu²⁺|Cu2\+/i);
});

test('buildPdfHtml renders unavailable scientific values without null or NaN text', () => {
  const html = buildPdfHtml({
    test: {
      id: 'unavailable-analysis',
      resultData: { pH: 'Unavailable', Nitrite: 'Unavailable' },
      overallStatus: 'NOT CLASSIFIED',
      remarks: 'Scientific comparison is pending.',
    },
  });

  assert.match(html, /pH:<\/strong> Unavailable/);
  assert.match(html, /Nitrite:<\/strong> Unavailable/);
  assert.doesNotMatch(html, /pH Category:/);
  assert.doesNotMatch(html, /NaN|null ppm|undefined/);
});

test('buildPdfHtml preserves the qualified Nitrite display text from the saved result', () => {
  const html = buildPdfHtml({
    test: {
      resultData: { pH: '2.00', Nitrite: '>1 ppm' },
      nitrite: { value: null, displayValue: '>1 ppm', qualifier: '>', lowerBound: 1 },
      remarks: 'Nitrite is above the supplied 1 ppm reference.',
    },
  });

  assert.match(html, /Nitrite:<\/strong> &gt;1 ppm/);
  assert.doesNotMatch(html, /NaN|null ppm|undefined|1\.00 ppm/);
});

test('buildPdfHtml normalizes historical sample identity and omits comparison-only fields', () => {
  const html = buildPdfHtml({
    test: {
      sampleCode: 'AA-03',
      sampleNumber: 3,
      sampleClass: 'AA',
      siteName: 'Pawikan',
      sourceType: 'Coastal water',
      reactionTime: '1 minute',
      capturedAt: '2026-10-03T03:11:55.000Z',
      scanStatus: 'Completed',
      phStatus: 'Estimated',
      pHResult: { measuredRGB: [173, 139, 123], status: 'Estimated' },
      nitrite: { measuredRGB: [197, 179, 195], displayValue: '>1 ppm', status: 'ABOVE_1_PPM' },
      measuredParametersStatus: 'Not classified',
      scientificValidationStatus: 'Pending laboratory validation',
      labComparison: {
        pH: { labValue: 8.21, absoluteDifference: 0.21, percentDifference: 2.56 },
        Nitrite: { labValue: null, absoluteDifference: null, percentDifference: null },
      },
      resultData: { pH: '8.00', Nitrite: '>1 ppm' },
      remarks: 'Provisional result.',
    },
  });

  for (const value of [
    'SA-03', 'Sample number', '1 minute', 'Scan Status', 'Completed',
    'pH Status', 'Estimated', 'Nitrite Status', 'ABOVE_1_PPM',
    '173, 139, 123', '197, 179, 195', 'SA',
  ]) assert.ok(html.includes(value), `expected report to include ${value}`);
  assert.doesNotMatch(html, /Scientific Validation|Laboratory Comparison|Laboratory pH|Pending laboratory|8\.21|0\.21|2\.56/i);
  assert.doesNotMatch(html, /Copper|Cu²⁺|Cu2\+/i);
});
