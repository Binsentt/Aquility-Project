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
  nitrite: { value: 0.5, unit: 'ppm', measuredRGB: [190, 172, 187.5], matchState: 'EXACT_OR_IN_RANGE', matchingMethod: 'direct-client-rgb-range' },
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
  assert.equal(result.nitrite.value, 0.5);
  assert.equal(result.nitrite.unit, 'ppm');
  assert.equal(result.overallStatus, 'NOT CLASSIFIED');
  assert.deepEqual(result.gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(result.imagePath, '/uploads/strip.jpg');
});

test('analysis service stores actual GPS alongside server-matched sampling-site identity', async () => {
  let createdRecord;
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    sampleSiteMatcher: () => ({
      classCode: 'AA',
      siteName: 'Pawikan',
      sourceType: 'Coastal / Pawikan',
      distanceMeters: 12,
    }),
    waterTestModel: {
      async create(record) {
        createdRecord = record;
        return { id: '3ec25331-d511-491f-a1b6-11670bc4a2d6', createdAt: '2026-08-04T00:00:00.000Z', ...record };
      },
    },
  });

  const result = await service.analyze({
    file: { filename: 'strip.jpg' },
    metadata: {
      userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
      gpsLatitude: '14.6',
      gpsLongitude: '120.98',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  });

  assert.equal(createdRecord.latitude, 14.6);
  assert.equal(createdRecord.longitude, 120.98);
  assert.equal(createdRecord.sampleClass, 'AA');
  assert.equal(createdRecord.siteName, 'Pawikan');
  assert.equal(createdRecord.sourceType, 'Coastal / Pawikan');
  assert.equal(result.sampleClass, 'AA');
  assert.equal(result.siteName, 'Pawikan');
});

test('analysis service preserves an explicitly selected sample code when canonical coordinates are not configured', async () => {
  let createdRecord;
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel: {
      async create(record) {
        createdRecord = record;
        return { id: 'sample-code-record', createdAt: '2026-08-04T00:00:00.000Z', ...record };
      },
    },
  });

  await service.analyze({
    file: { filename: 'strip.jpg' },
    metadata: {
      sampleCode: 'AA-03',
      gpsLatitude: '14.6',
      gpsLongitude: '120.98',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  });

  assert.equal(createdRecord.sampleCode, 'AA-03');
  assert.equal(createdRecord.sampleNumber, null);
  assert.equal(createdRecord.sampleClass, 'AA');
  assert.equal(createdRecord.siteName, 'Pawikan');
  assert.equal(createdRecord.sourceType, 'Coastal / Pawikan');
});

test('analysis diagnostics carry a request-correlated analysis id without user data', async () => {
  const events = [];
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze({ debugLogger }) { debugLogger?.('upad-registration', { status: 'REGISTERED' }); return sampleMeasurements; } },
    waterTestModel: { async create(record) { return { id: 'diagnostic-record', createdAt: '2026-08-04T00:00:00.000Z', ...record }; } },
  });

  await service.analyze({
    file: { filename: 'strip.jpg' },
    metadata: { capturedAt: '2026-08-04T00:00:00.000Z' },
    authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
    requestId: 'request-diagnostic-1',
    requestDebugLogger: (stage, details) => events.push({ stage, details }),
  });

  assert.deepEqual(events[0], { stage: 'upad-registration', details: { analysisId: 'request-diagnostic-1', status: 'REGISTERED' } });
  assert.equal(events.some(({ details }) => 'email' in details || 'token' in details), false);
});

test('analysis service maps selected sample metadata to its study site independently of GPS', async () => {
  let createdRecord;
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel: {
      async create(record) {
        createdRecord = record;
        return { id: 'selected-sample-record', createdAt: '2026-08-04T00:00:00.000Z', ...record };
      },
    },
  });

  const result = await service.analyze({
    file: { filename: 'strip.jpg' },
    metadata: {
      sampleClass: 'C',
      sampleCode: 'C-15',
      sampleNumber: '15',
      gpsLatitude: '14.6',
      gpsLongitude: '120.98',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  });

  assert.equal(createdRecord.sampleClass, 'C');
  assert.equal(createdRecord.sampleCode, 'C-15');
  assert.equal(createdRecord.sampleNumber, 15);
  assert.equal(createdRecord.siteName, 'Fish Farm');
  assert.equal(createdRecord.sourceType, 'Fish Farm / Aquaculture');
  assert.equal(createdRecord.canonicalLatitude, null);
  assert.equal(createdRecord.canonicalLongitude, null);
  assert.equal(result.siteName, 'Fish Farm');
});

test('analysis service rejects inconsistent selected sample class and code', async () => {
  const service = createWaterAnalysisService({
    colorAnalysisEngine: { async analyze() { return sampleMeasurements; } },
    waterTestModel: { async create() { throw new Error('should not save'); } },
  });

  await assert.rejects(
    service.analyze({
      file: { filename: 'strip.jpg' },
      metadata: { sampleClass: 'AA', sampleCode: 'C-01', sampleNumber: 1, capturedAt: '2026-08-04T00:00:00.000Z' },
      authenticatedUserId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
    }),
    (error) => error.code === 'INVALID_SAMPLE_SITE'
  );
});

test('water-test serialization retains pH color metadata and direct Nitrite RGB output', () => {
  const result = serializeWaterTest({
    id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    imagePath: '/uploads/strip.jpg',
    estimatedPH: 6,
    phStatus: 'Unvalidated',
    estimatedNitrite: 0.5,
    nitriteStatus: 'Unvalidated',
    analysisData: { pH: sampleMeasurements.pH, nitrite: sampleMeasurements.nitrite },
    overallStatus: 'Unvalidated',
    remarks: sampleMeasurements.remarks,
  });

  assert.equal(result.pH, 6);
  assert.equal(result.pHResult.deltaE00, 2.1);
  assert.deepEqual(result.pHResult.measuredLab, [80, -10, 60]);
  assert.equal(result.nitrite.value, 0.5);
  assert.equal(result.nitrite.unit, 'ppm');
  assert.equal(result.nitrite.matchState, 'EXACT_OR_IN_RANGE');
  assert.equal(result.nitrite.matchingMethod, 'direct-client-rgb-range');
  assert.equal(result.resultData.Nitrite, '0.50 ppm');
  assert.equal(result.nitrate, undefined);
  assert.deepEqual(result.labComparison, {
    pH: { labValue: null, absoluteDifference: null, percentDifference: null },
    Nitrite: { labValue: null, absoluteDifference: null, percentDifference: null },
  });
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
  assert.equal(result.overallStatus, 'NOT CLASSIFIED');
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

test('analysis endpoint receives multipart images above the former 10 MB limit', async () => {
  const userId = '8ed82724-1db6-452a-a872-f6e5c81d8b5a';
  let receivedFile;
  const app = createApp({
    authTokenService: { verifyAccessToken: () => ({ userId }) },
    waterAnalysisService: {
      async analyze({ file, metadata, authenticatedUserId }) {
        receivedFile = { filename: file.filename, mimetype: file.mimetype, size: file.size, metadata, authenticatedUserId };
        await rm(file.path, { force: true });
        return { analysisId: 'analysis-1', overallStatus: 'Unvalidated' };
      },
    },
  });

  const response = await request(app)
    .post('/api/analyze-water')
    .set('Authorization', 'Bearer valid-token')
    .field('userId', userId)
    .field('capturedAt', '2026-08-04T00:00:00.000Z')
    .attach('image', Buffer.alloc(11 * 1024 * 1024, 1), { filename: 'strip.jpg', contentType: 'image/jpeg' });

  assert.equal(response.status, 201);
  assert.equal(response.body.analysisId, 'analysis-1');
  assert.equal(receivedFile.mimetype, 'image/jpeg');
  assert.equal(receivedFile.size, 11 * 1024 * 1024);
  assert.equal(receivedFile.authenticatedUserId, userId);
  assert.equal(receivedFile.metadata.userId, userId);
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
