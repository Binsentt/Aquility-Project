import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterTestModel } from '../models/waterTestModel.js';
import { createMapService } from '../services/mapService.js';

test('map query reads saved pH and Nitrite analysis display without loading full analysis metadata', async () => {
  let executedSql = '';
  const pool = {
    async query(sql) {
      executedSql = sql;
      return {
        rows: [
          {
            id: 'qualified', latitude: '14.6', longitude: '120.98', sampleClass: 'AA',
            siteName: 'Pawikan', sourceType: 'Coastal / Pawikan', overallStatus: 'NOT CLASSIFIED',
            capturedAt: '2026-10-03T01:02:03.000Z', barangay: 'San Isidro', municipality: 'Sample City',
            pH: '7.25', nitriteDisplay: '>1 ppm', nitriteValue: null, nitriteClassificationStatus: 'Dangerous',
          },
          {
            id: 'measured', latitude: 1, longitude: 2, pH: null,
            nitriteDisplay: null, nitriteValue: '0.5', nitriteClassificationStatus: 'Warning',
          },
          {
            id: 'low-confidence', latitude: 2, longitude: 3, pH: null,
            nitriteDisplay: null, nitriteLowConfidenceDisplay: 'Closest reference: 0 ppm (low confidence)',
            nitriteValue: null, nitriteClassificationStatus: null,
          },
          {
            id: 'unavailable', latitude: 3, longitude: 4, pH: null,
            nitriteDisplay: null, nitriteValue: null, nitriteClassificationStatus: null,
          },
        ],
      };
    },
  };
  const markers = await createWaterTestModel(pool).listMarkers();

  assert.match(executedSql, /estimated_ph AS "pH"/i);
  assert.match(executedSql, /analysis_data\s*#>>\s*'{nitrite,displayValue}'\s+AS "nitriteDisplay"/i);
  assert.match(executedSql, /analysis_data\s*#>>\s*'{nitrite,lowConfidenceDisplay}'\s+AS "nitriteLowConfidenceDisplay"/i);
  assert.match(executedSql, /analysis_data\s*#>>\s*'{nitrite,value}'\s+AS "nitriteValue"/i);
  assert.match(executedSql, /analysis_data\s*#>>\s*'{nitrite,classificationStatus}'\s+AS "nitriteClassificationStatus"/i);
  assert.doesNotMatch(executedSql, /analysis_data\s+AS/i);
  assert.equal(markers[0].pH, 7.25);
  assert.equal(markers[0].nitriteDisplay, '>1 ppm');
  assert.equal(markers[0].nitriteStatus, 'Dangerous');
  assert.equal(markers[1].nitriteDisplay, '0.50 ppm');
  assert.equal(markers[1].nitriteStatus, 'Warning');
  assert.equal(markers[2].nitriteDisplay, 'Closest reference: 0 ppm (low confidence)');
  assert.equal(markers[2].nitriteStatus, null);
  assert.equal(markers[3].nitriteDisplay, 'Unavailable');
});

test('public map service returns only safe marker details and canonical study classes', async () => {
  const service = createMapService({
    waterTestModel: {
      async listMarkers() {
        return [{
          id: 'qualified', latitude: 14.6, longitude: 120.98, overallStatus: 'NOT CLASSIFIED',
          capturedAt: '2026-10-03T01:02:03.000Z', barangay: 'San Isidro', municipality: 'Sample City',
          sampleClass: 'AA', siteName: 'Pawikan', sourceType: 'Coastal', pH: 6.8,
          nitriteDisplay: '>1 ppm', nitriteStatus: 'Dangerous', email: 'private@example.test', phoneNumber: 'private',
          imagePath: '/private/image.jpg', analysisData: { measuredRGB: [1, 2, 3] }, roiCoordinates: [1, 2],
        }, {
          id: 'invalid-measurement', latitude: 14.7, longitude: 120.9,
          pH: true, nitriteDisplay: { internal: 'must not leak' },
        }];
      },
    },
  });

  assert.deepEqual(await service.listMarkers(), [{
    id: 'qualified', latitude: 14.6, longitude: 120.98, overallStatus: 'NOT CLASSIFIED',
    capturedAt: '2026-10-03T01:02:03.000Z', barangay: 'San Isidro', municipality: 'Sample City',
    sampleClass: 'SA', siteName: 'Pawikan', sourceType: 'Coastal', pH: 6.8, nitriteDisplay: '>1 ppm', nitriteStatus: 'Dangerous',
  }, {
    id: 'invalid-measurement', latitude: 14.7, longitude: 120.9, overallStatus: 'NOT CLASSIFIED',
    capturedAt: null, barangay: null, municipality: null, sampleClass: null, siteName: null, sourceType: null,
    pH: null, nitriteDisplay: 'Unavailable',
  }]);
});
