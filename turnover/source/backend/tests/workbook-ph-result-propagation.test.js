import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { toMapMarker, toScanResult } from '../../services/apiMappers.js';
import { buildPdfHtml } from '../../services/reportTemplate.js';

test('an accepted grouped workbook pH display stays non-numeric through saved Result, History, Map, and PDF views', () => {
  const serialized = serializeWaterTest({
    id: 'grouped-workbook-ph',
    createdAt: '2026-11-13T00:00:00.000Z',
    estimatedPH: null,
    phStatus: 'Estimated',
    estimatedNitrite: null,
    nitriteStatus: 'Unavailable',
    analysisData: {
      pH: {
        value: null,
        exactValue: null,
        displayValue: '9-14',
        groupedReference: true,
        status: 'Estimated',
        reliabilityStatus: 'CLIENT_WORKBOOK_RGB_REFERENCE_MATCH',
        matchedReference: { label: '9-14', source: 'client-workbook-rgb-sample' },
        measuredRGB: [177, 181, 175],
      },
      nitrite: { value: null, displayValue: null, status: 'Unavailable', measuredRGB: [150, 145, 137] },
    },
    overallStatus: 'NOT CLASSIFIED',
    remarks: 'Separate µPAD sensing areas were localized.',
  });
  const resultView = toScanResult(serialized, 'https://aquality-api.example.test/api');
  const marker = toMapMarker({
    id: serialized.id,
    latitude: 14.6,
    longitude: 120.98,
    pH: serialized.pH,
    pHResult: serialized.pHResult,
    resultData: serialized.resultData,
  });
  const pdf = buildPdfHtml({ test: resultView });

  assert.equal(serialized.pH, null);
  assert.equal(serialized.resultData.pH, '9-14');
  assert.equal(resultView.pH, null);
  assert.equal(resultView.resultData.pH, '9-14');
  assert.equal(resultView.resultData['pH Category'], undefined);
  assert.equal(marker.pH, null);
  assert.equal(marker.pHDisplay, '9-14');
  assert.match(pdf, /pH:<\/strong> 9-14/);
  assert.doesNotMatch(pdf, /pH Category:/);
});
