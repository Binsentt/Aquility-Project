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
        Nitrite: '0.50 ppm',
      },
      overallStatus: 'NOT CLASSIFIED',
      measuredParametersStatus: 'Not classified',
      scientificValidationStatus: 'Pending laboratory validation',
      remarks: 'Water quality appears acceptable based on the current estimated values.',
    },
  });

  for (const expected of ['Ana Cruz', 'ana@example.test', '09171234567', 'San Isidro', '6.80', '0.50 ppm', 'Nitrite:', '14.6000', 'AA', 'Pawikan', 'Coastal / Pawikan', 'Not classified', 'Pending laboratory validation', 'acceptable']) {
    assert.match(html, new RegExp(expected));
  }
  assert.match(html, /Measured Parameters Status/);
  assert.match(html, /Scientific Validation/);
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
  assert.doesNotMatch(html, /NaN|null ppm|undefined/);
});
