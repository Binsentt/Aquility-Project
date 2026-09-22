import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';
import { createWaterAnalysisService } from '../services/waterAnalysisService.js';
import { createApp } from '../app.js';

test('mock color analysis returns the replaceable safe reference sample', async () => {
  const engine = createColorAnalysisEngine();
  const result = await engine.analyze({ imagePath: '/uploads/water-strip.jpg' });

  assert.deepEqual(result, {
    pH: 6.8,
    phStatus: 'Normal',
    nitrate: 3.5,
    nitrateStatus: 'Safe',
    overallStatus: 'Safe',
    remarks: 'Water quality appears acceptable based on the current estimated values.',
  });
});

test('analysis service stores upload metadata and returns a stable result shape', async () => {
  const waterTestModel = {
    async create(record) {
      return { id: '3ec25331-d511-491f-a1b6-11670bc4a2d6', createdAt: '2026-08-04T00:00:00.000Z', ...record };
    },
  };
  const service = createWaterAnalysisService({
    colorAnalysisEngine: createColorAnalysisEngine(),
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
  assert.equal(result.pH, 6.8);
  assert.deepEqual(result.gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(result.imagePath, '/uploads/strip.jpg');
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
    colorAnalysisEngine: createColorAnalysisEngine(),
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
    colorAnalysisEngine: createColorAnalysisEngine(),
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
