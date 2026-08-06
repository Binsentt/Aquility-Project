import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfHtml } from './reportTemplate.js';

test('buildPdfHtml renders the Aquility mark only when a resolved brand image is supplied', () => {
  const branded = buildPdfHtml({ brandImageUri: 'data:image/png;base64,brand' });
  const fallback = buildPdfHtml();

  assert.match(branded, /data-brand-logo="aquility"/);
  assert.match(branded, /data:image\/png;base64,brand/);
  assert.doesNotMatch(fallback, /data-brand-logo="aquility"/);
  assert.match(fallback, /AQUILITY Water Test Report/);
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
      resultData: {
        pH: '6.80',
        Nitrate: '3.50 mg/L',
        'Copper (Cu²⁺)': '0.600 mg/L',
      },
      overallStatus: 'Safe',
      remarks: 'Water quality appears acceptable based on the current estimated values.',
    },
  });

  for (const expected of ['Ana Cruz', 'ana@example.test', '09171234567', 'San Isidro', '6.80', '3.50 mg/L', '0.600 mg/L', '14.6000', 'Safe', 'acceptable']) {
    assert.match(html, new RegExp(expected));
  }
  assert.match(html, /<img /);
  assert.match(html, /water-tests\/3ec25331-d511-491f-a1b6-11670bc4a2d6\/image\?token=short-lived-token/);
  assert.match(html, /google\.com\/maps/);
});
