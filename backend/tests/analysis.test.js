import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createWaterAnalysisService } from '../services/waterAnalysisService.js';
import { createApp } from '../app.js';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';

const sampleMeasurements = {
  pH: { value: 6, unit: 'pH', measuredRGB: [200, 190, 40], measuredLab: [80, -10, 60], matchedReference: { label: '6' }, deltaE00: 2.1 },
  nitrite: { value: 10, unit: 'ppm', measuredRGB: [255, 128, 64], hue: 30, calibrationInterval: { hue: [15, 30], ppm: [0, 10] }, interpolationMethod: 'piecewise-linear-clamped' },
  phStatus: 'Unvalidated',
  nitriteStatus: 'Unvalidated',
  overallStatus: 'Unvalidated',
  remarks: 'Client calibration output requires experimental validation.',
};

test('analysis service stores upload metadata and returns a stable result shape', async () => {
  const waterTestModel = {
    async create(record) {
      return { id: '3ec25331-d511-491f-a1b6-11670bc4a2d6', createdAt: '2026-08-04T00:00:00.000Z', ...record };
    },
  };
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel,
  });

  const result = await service.analyze({
    file: { filename: 'strip.jpg' },
    metadata: {
      userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
      gpsLatitude: '14.6',
      gpsLongitude: '120.98',
      barangay: 'San Isidro',
      municipality: 'Sample City',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  });

  assert.equal(result.analysisId, '3ec25331-d511-491f-a1b6-11670bc4a2d6');
  assert.equal(result.pH, 6);
  assert.equal(result.nitrite.value, 10);
  assert.equal(result.nitrite.unit, 'ppm');
  assert.equal(result.overallStatus, 'Unvalidated');
  assert.deepEqual(result.gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(result.imagePath, '/uploads/strip.jpg');
});

test('water-test serialization retains pH color metadata and Nitrite interpolation output', () => {
  const result = serializeWaterTest({
    id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    imagePath: '/uploads/strip.jpg',
    estimatedPH: 6,
    phStatus: 'Unvalidated',
    estimatedNitrite: 10,
    nitriteStatus: 'Unvalidated',
    analysisData: { pH: sampleMeasurements.pH, nitrite: sampleMeasurements.nitrite },
    overallStatus: 'Unvalidated',
    remarks: sampleMeasurements.remarks,
  });

  assert.equal(result.pH, 6);
  assert.equal(result.pHResult.deltaE00, 2.1);
  assert.deepEqual(result.pHResult.measuredLab, [80, -10, 60]);
  assert.equal(result.nitrite.value, 10);
  assert.equal(result.nitrite.unit, 'ppm');
  assert.deepEqual(result.nitrite.calibrationInterval.hue, [15, 30]);
  assert.equal(result.resultData.Nitrite, '10.00 ppm');
  assert.equal(result.nitrate, undefined);
});

test('legacy Nitrate-only records do not serialize their concentration as Nitrite', () => {
  const result = serializeWaterTest({
    id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    imagePath: '/uploads/old-strip.jpg',
    estimatedPH: 6.8,
    estimatedNitrate: 3.5,
    nitrateStatus: 'Safe',
    overallStatus: 'Safe',
    remarks: 'Historical result.',
  });

  assert.equal(result.nitrite.value, null);
  assert.equal(result.resultData.Nitrite, 'Unavailable');
  assert.equal(result.overallStatus, 'Unvalidated');
  assert.match(result.remarks, /cannot be interpreted as Nitrite/);
});

test('analysis endpoint rejects a request without an image', async () => {
  const app = createApp({
    authTokenService: { verifyAccessToken: () => ({ userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a' }) },
    waterAnalysisService: { analyze: async () => null },
  });

  const response = await request(app)
    .post('/api/analyze-water')
    .set('Authorization', 'Bearer valid-token')
    .field('userId', '8ed82724-1db6-452a-a872-f6e5c81d8b5a');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'IMAGE_REQUIRED');
});

test('analysis service rejects overlong location metadata before storing a water test', async () => {
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel: { async create() { throw new Error('A validation failure must not create a water test.'); } },
  });

  await assert.rejects(
    () => service.analyze({
      file: { filename: 'strip.jpg' },
      authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
      metadata: {
        userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
        capturedAt: '2026-08-04T00:00:00.000Z',
        barangay: 'x'.repeat(121),
      },
    }),
    { code: 'INVALID_INPUT' }
  );
});

test('analysis validation removes an uploaded file when metadata is rejected', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'aquility-analysis-'));
  const filePath = join(temporaryDirectory, 'strip.upload');
  await writeFile(filePath, 'not-reached-when-metadata-is-invalid');
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel: { async create() { throw new Error('A rejected request must not create a water test.'); } },
  });

  try {
    await assert.rejects(
      () => service.analyze({
        file: { filename: 'strip.upload', path: filePath },
        authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
        metadata: {
          userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
          capturedAt: '2026-08-04T00:00:00.000Z',
          barangay: 'x'.repeat(121),
        },
      }),
      { code: 'INVALID_INPUT' }
    );

    await assert.rejects(() => access(filePath), { code: 'ENOENT' });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
