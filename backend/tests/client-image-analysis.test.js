import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { toScanResult } from '../../services/apiMappers.js';
import { buildPdfHtml } from '../../services/reportTemplate.js';

const uploadDirectory = await mkdtemp(join(tmpdir(), 'aquality-client-image-api-'));
const priorUploadDirectory = process.env.UPLOAD_DIR;
process.env.UPLOAD_DIR = uploadDirectory;

after(async () => {
  if (priorUploadDirectory == null) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = priorUploadDirectory;
  await rm(uploadDirectory, { recursive: true, force: true });
});

test('real client image completes authenticated upload, analysis, persistence, and API serialization', async () => {
  {
    const [{ createApp }, { createColorAnalysisEngine }, { createWaterAnalysisService }] = await Promise.all([
      import('../app.js'),
      import('../services/colorAnalysisEngine.js'),
      import('../services/waterAnalysisService.js'),
    ]);
    const userId = '8ed82724-1db6-452a-a872-f6e5c81d8b5a';
    const image = await readFile(new URL('./fixtures/real-client-930-aw-1min.jpg', import.meta.url));
    let persisted;
    const waterAnalysisService = createWaterAnalysisService({
      colorAnalysisEngine: createColorAnalysisEngine(),
      userModel: { async findById(id) { return id === userId ? { id, accountType: 'registered' } : null; } },
      waterTestModel: {
        async create(record) {
          persisted = record;
          return {
            id: 'real-client-image-test',
            createdAt: '2026-10-03T00:00:00.000Z',
            ...record,
          };
        },
      },
    });
    const app = createApp({
      authTokenService: { verifyAccessToken: () => ({ userId }) },
      waterAnalysisService,
    });

    const response = await request(app)
      .post('/api/analyze-water')
      .set('Authorization', 'Bearer test-token')
      .field('sampleClass', 'AA')
      .field('sampleCode', 'AA-03')
      .field('capturedAt', '2026-10-03T00:00:00.000Z')
      .attach('image', image, { filename: 'client-strip.jpg', contentType: 'image/jpeg' });

    assert.equal(response.status, 201);
    assert.equal(response.body.scanStatus, 'Completed');
    assert.equal(response.body.sampleCode, 'SA-03');
    assert.equal(response.body.sampleClass, 'SA');
    assert.equal(response.body.pH, null);
    assert.equal(response.body.resultData.pH, 'No reference match');
    assert.equal(response.body.nitrite.value, null);
    assert.equal(response.body.resultData.Nitrite, 'No reference match');
    assert.equal(response.body.roiLocalizationStatus, 'Registered µPAD template');
    assert.equal(persisted.estimatedPH, null);
    assert.equal(persisted.estimatedNitrite, null);
    assert.notDeepEqual(persisted.analysisData.pH.measuredRGB, persisted.analysisData.nitrite.measuredRGB);
    assert.notDeepEqual(persisted.analysisData.pH.roi.normalized, persisted.analysisData.nitrite.roi.normalized);
    assert.equal(response.body.pHResult.measuredRGB.length, 3);
    assert.equal(response.body.nitrite.measuredRGB.length, 3);
    assert.deepEqual(response.body.pHResult.measuredRGB, [141, 151, 115]);
    assert.deepEqual(response.body.nitrite.measuredRGB, [161, 154, 144]);
    assert.match(response.body.remarks, /RGB 141, 151, 115/);
    assert.match(response.body.remarks, /RGB 161, 154, 144/);
    assert.doesNotMatch(response.body.remarks, /laboratory|scientific validation|certified/i);
  }
});

test('real client pH ROI value survives API persistence, Result/History mapping, and PDF template', async () => {
  {
    const [{ createApp }, { createColorAnalysisEngine }, { createWaterAnalysisService }] = await Promise.all([
      import('../app.js'),
      import('../services/colorAnalysisEngine.js'),
      import('../services/waterAnalysisService.js'),
    ]);
    const userId = '8ed82724-1db6-452a-a872-f6e5c81d8b5a';
    const image = await readFile(new URL('./fixtures/real-client-930-aw-ph2.jpg', import.meta.url));
    let persisted;
    const waterAnalysisService = createWaterAnalysisService({
      colorAnalysisEngine: createColorAnalysisEngine(),
      userModel: { async findById(id) { return id === userId ? { id, accountType: 'registered' } : null; } },
      waterTestModel: {
        async create(record) {
          persisted = record;
          return { id: 'real-client-ph2-test', createdAt: '2026-10-03T00:00:00.000Z', ...record };
        },
      },
    });
    const app = createApp({
      authTokenService: { verifyAccessToken: () => ({ userId }) },
      waterAnalysisService,
    });

    const response = await request(app)
      .post('/api/analyze-water')
      .set('Authorization', 'Bearer test-token')
      .field('sampleClass', 'A')
      .field('sampleCode', 'A-01')
      .field('capturedAt', '2026-10-03T00:00:00.000Z')
      .attach('image', image, { filename: 'client-ph2-strip.jpg', contentType: 'image/jpeg' });

    assert.equal(response.status, 201);
    assert.equal(response.body.scanStatus, 'Completed');
    assert.equal(response.body.pH, 2);
    assert.equal(response.body.pHResult.value, 2);
    assert.equal(response.body.pHResult.matchMethod, 'direct-client-rgb-range');
    assert.ok(response.body.pHResult.roi.sampleCount > 0);
    assert.ok(response.body.pHResult.measuredRGB.every(Number.isFinite));
    assert.equal(response.body.resultData.pH, '2.00');
    assert.equal(response.body.nitrite.value, null);
    assert.equal(response.body.resultData.Nitrite, 'No reference match');
    assert.equal(persisted.estimatedPH, 2);
    assert.deepEqual(persisted.analysisData.pH.measuredRGB, response.body.pHResult.measuredRGB);
    assert.deepEqual(persisted.analysisData.pH.roi.normalized, response.body.pHResult.roi.normalized);

    const resultView = toScanResult(response.body, 'https://aquality-api.example.test/api');
    const historyRecord = serializeWaterTest({
      ...persisted,
      id: 'real-client-ph2-test',
      createdAt: '2026-10-03T00:00:00.000Z',
    });
    const historyView = toScanResult(historyRecord, 'https://aquality-api.example.test/api');
    assert.equal(resultView.resultData.pH, historyView.resultData.pH);
    assert.equal(resultView.resultData.Nitrite, historyView.resultData.Nitrite);

    const pdf = buildPdfHtml({ test: historyView });
    assert.match(pdf, /pH:<\/strong> 2\.00/);
    assert.match(pdf, /Nitrite:<\/strong> No reference match/);
    assert.deepEqual(historyView.pHResult.measuredRGB, response.body.pHResult.measuredRGB);
    assert.deepEqual(historyView.nitrite.measuredRGB, response.body.nitrite.measuredRGB);
    assert.doesNotMatch(pdf, /NaN|null ppm|undefined/);
  }
});

test('qualified Nitrite value survives upload API, persistence, Result, History, and PDF without an exact ppm value', async () => {
  const [{ createApp }, { createColorAnalysisEngine }, { createWaterAnalysisService }] = await Promise.all([
    import('../app.js'),
    import('../services/colorAnalysisEngine.js'),
    import('../services/waterAnalysisService.js'),
  ]);
  const userId = 'af2dcf50-480f-4318-a45d-48250e5bf598';
  const calibration = JSON.parse(await readFile(new URL('../database/colorAnalysisCalibration.json', import.meta.url), 'utf8'));
  const developerCalibration = {
    ...calibration,
    roi: {
      ...calibration.roi,
      productionAllowed: false,
      registration: { ...calibration.roi.registration, enabled: false },
      regions: {
        pH: { x: 0, y: 0, width: 0.5, height: 1 },
        nitrite: { x: 0.5, y: 0, width: 0.5, height: 1 },
      },
    },
  };
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [168, 133, 122] : [197, 179, 195], (y * 20 + x) * 3);
    }
  }
  const image = await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toBuffer();
  let persisted;
  const waterAnalysisService = createWaterAnalysisService({
    colorAnalysisEngine: createColorAnalysisEngine({
      readJson: async () => developerCalibration,
      allowDeveloperRoiFixture: true,
    }),
    userModel: { async findById(id) { return id === userId ? { id, accountType: 'registered' } : null; } },
    waterTestModel: {
      async create(record) {
        persisted = record;
        return { id: 'qualified-nitrite-test', createdAt: '2026-10-03T00:00:00.000Z', ...record };
      },
    },
  });
  const app = createApp({
    authTokenService: { verifyAccessToken: () => ({ userId }) },
    waterAnalysisService,
  });
  const response = await request(app)
    .post('/api/analyze-water')
    .set('Authorization', 'Bearer test-token')
    .field('capturedAt', '2026-10-03T00:00:00.000Z')
    .attach('image', image, { filename: 'qualified-nitrite.png', contentType: 'image/png' });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.nitrite.value, null);
  assert.equal(response.body.nitrite.displayValue, '>1 ppm');
  assert.deepEqual(response.body.nitrite.measuredRGB, [197, 179, 195]);
  assert.equal(response.body.resultData.Nitrite, '>1 ppm');
  assert.equal(persisted.estimatedNitrite, null);
  assert.equal(persisted.analysisData.nitrite.matchState, 'ABOVE_1_PPM');

  const resultView = toScanResult(response.body, 'https://aquality-api.example.test/api');
  const historyRecord = serializeWaterTest({
    ...persisted,
    id: 'qualified-nitrite-test',
    createdAt: '2026-10-03T00:00:00.000Z',
  });
  const historyView = toScanResult(historyRecord, 'https://aquality-api.example.test/api');
  assert.equal(resultView.resultData.Nitrite, historyView.resultData.Nitrite);
  const pdf = buildPdfHtml({ test: historyView });
  assert.match(pdf, /Nitrite:<\/strong> &gt;1 ppm/);
  assert.match(pdf, /197, 179, 195/);
  assert.doesNotMatch(pdf, /1\.00 ppm|NaN|null ppm|undefined/);
});
