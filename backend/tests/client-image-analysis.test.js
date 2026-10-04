import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { toMapMarker, toScanResult } from '../../services/apiMappers.js';
import { buildPdfHtml } from '../../services/reportTemplate.js';

const uploadDirectory = await mkdtemp(join(tmpdir(), 'aquality-client-image-api-'));
const priorUploadDirectory = process.env.UPLOAD_DIR;
process.env.UPLOAD_DIR = uploadDirectory;

after(async () => {
  if (priorUploadDirectory == null) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = priorUploadDirectory;
  await rm(uploadDirectory, { recursive: true, force: true });
});

async function createDeveloperRoiImage(pHRgb, nitriteRgb) {
  const width = 20;
  const height = 20;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(x < width / 2 ? pHRgb : nitriteRgb, (y * width + x) * 3);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function createComputedResultTestApp() {
  const [{ createApp }, { createColorAnalysisEngine }, { createWaterAnalysisService }] = await Promise.all([
    import('../app.js'),
    import('../services/colorAnalysisEngine.js'),
    import('../services/waterAnalysisService.js'),
  ]);
  const userId = '6e705ada-7c06-42b4-a9f2-5b12b9a17721';
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
  const persistedRecords = [];
  const engineCalls = [];
  const imageAnalyzer = createColorAnalysisEngine({
    readJson: async () => developerCalibration,
    allowDeveloperRoiFixture: true,
  });
  const waterAnalysisService = createWaterAnalysisService({
    colorAnalysisEngine: {
      async analyze(input) {
        engineCalls.push({ keys: Object.keys(input).sort(), imagePath: input.imagePath });
        return imageAnalyzer.analyze(input);
      },
    },
    userModel: { async findById(id) { return id === userId ? { id, accountType: 'registered' } : null; } },
    waterTestModel: {
      async create(record) {
        const saved = {
          id: `computed-result-guard-${persistedRecords.length + 1}`,
          createdAt: '2026-10-04T00:00:00.000Z',
          ...record,
        };
        persistedRecords.push(saved);
        return saved;
      },
    },
  });
  const app = createApp({
    authTokenService: { verifyAccessToken: () => ({ userId }) },
    waterAnalysisService,
  });
  return { app, persistedRecords, engineCalls };
}

function submitDeveloperImage(app, image, metadata) {
  const form = request(app)
    .post('/api/analyze-water')
    .set('Authorization', 'Bearer test-token');
  for (const [key, value] of Object.entries(metadata)) form.field(key, String(value));
  return form.attach('image', image, { filename: 'same-uploaded-name.png', contentType: 'image/png' });
}

function chemistrySnapshot(response) {
  return {
    pH: response.body.pH,
    pHValue: response.body.pHResult.value,
    pHRgb: response.body.pHResult.measuredRGB,
    pHMatch: response.body.pHResult.matchedReference?.value ?? null,
    nitriteValue: response.body.nitrite.value,
    nitriteDisplayValue: response.body.nitrite.displayValue ?? null,
    nitriteRgb: response.body.nitrite.measuredRGB,
    nitriteMatch: response.body.nitrite.matchState,
    nitriteClassificationStatus: response.body.nitriteClassificationStatus,
  };
}

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
    assert.ok(response.body.pH >= 7.22 && response.body.pH <= 8.21);
    assert.equal(response.body.resultData.pH, '8.0');
    assert.equal(response.body.pHResult.matchMethod, 'official-time-continuous-lab-ridge-quadratic');
    assert.equal(response.body.pHResult.exactValue, null);
    assert.equal(response.body.nitrite.value, null);
    assert.equal(response.body.resultData.Nitrite, 'No reference match');
    assert.equal(response.body.roiLocalizationStatus, 'Registered µPAD template');
    assert.equal(persisted.estimatedPH, response.body.pH);
    assert.equal(persisted.estimatedNitrite, null);
    assert.notDeepEqual(persisted.analysisData.pH.measuredRGB, persisted.analysisData.nitrite.measuredRGB);
    assert.notDeepEqual(persisted.analysisData.pH.roi.normalized, persisted.analysisData.nitrite.roi.normalized);
    assert.equal(response.body.pHResult.measuredRGB.length, 3);
    assert.equal(response.body.nitrite.measuredRGB.length, 3);
    // These fixture measurements come from the registered inner ellipse. The
    // selected class cannot supply or override the color-derived pH value.
    assert.deepEqual(response.body.pHResult.measuredRGB, [141, 152, 115]);
    assert.deepEqual(response.body.nitrite.measuredRGB, [162, 154, 145]);
    assert.match(response.body.remarks, /RGB 162, 154, 145/);
    assert.doesNotMatch(response.body.remarks, /laboratory|scientific validation|certified/i);
  }
});

test('real portrait client color is not falsely assigned to pH after fiducial role correction', async () => {
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
    assert.equal(response.body.pH, null);
    assert.equal(response.body.pHResult.value, null);
    assert.equal(response.body.pHResult.status, 'PH_MEASUREMENT_UNRELIABLE');
    assert.ok(response.body.pHResult.roi.sampleCount > 0);
    assert.ok(response.body.pHResult.measuredRGB.every(Number.isFinite));
    assert.equal(response.body.resultData.pH, 'No reference match');
    assert.equal(response.body.nitrite.value, null);
    assert.equal(response.body.resultData.Nitrite, 'No reference match');
    // Inner-ellipse fixture RGB is a geometry regression assertion only.
    assert.equal(response.body.pHResult.measuredRGB.join(','), '135,148,123');
    assert.equal(persisted.estimatedPH, null);
    assert.deepEqual(persisted.analysisData.pH.measuredRGB, response.body.pHResult.measuredRGB);
    assert.deepEqual(persisted.analysisData.pH.roi.normalized, response.body.pHResult.roi.normalized);
    assert.ok(response.body.nitrite.roi.normalized.y > response.body.pHResult.roi.normalized.y);

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
    assert.match(pdf, /pH:<\/strong> No reference match/);
    assert.match(pdf, /Nitrite:<\/strong> No reference match/);
    assert.deepEqual(historyView.pHResult.measuredRGB, response.body.pHResult.measuredRGB);
    assert.deepEqual(historyView.nitrite.measuredRGB, response.body.nitrite.measuredRGB);
    assert.doesNotMatch(pdf, /pH:<\/strong> 2\.00|NaN|null ppm|undefined/);
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
  assert.equal(response.body.nitriteClassificationStatus, 'Dangerous');
  assert.deepEqual(response.body.nitrite.measuredRGB, [197, 179, 195]);
  assert.equal(response.body.resultData.Nitrite, '>1 ppm');
  assert.equal(response.body.resultData['Nitrite Status'], 'Dangerous');
  assert.equal(response.body.resultData['Measured Parameters Status'], undefined);
  assert.equal(response.body.resultData.Nitrite, '>1 ppm');
  assert.equal(persisted.estimatedNitrite, null);
  assert.equal(persisted.analysisData.nitrite.matchState, 'ABOVE_1_PPM');
  assert.equal(persisted.analysisData.nitrite.classificationStatus, 'Dangerous');

  const resultView = toScanResult(response.body, 'https://aquality-api.example.test/api');
  const historyRecord = serializeWaterTest({
    ...persisted,
    id: 'qualified-nitrite-test',
    createdAt: '2026-10-03T00:00:00.000Z',
  });
  const historyView = toScanResult(historyRecord, 'https://aquality-api.example.test/api');
  assert.equal(resultView.resultData.Nitrite, historyView.resultData.Nitrite);
  assert.equal(resultView.resultData['Nitrite Status'], historyView.resultData['Nitrite Status']);
  const pdf = buildPdfHtml({ test: historyView });
  assert.match(pdf, /Nitrite:<\/strong> &gt;1 ppm/);
  assert.match(pdf, /Nitrite Status:<\/strong> Dangerous/);
  assert.match(pdf, /197, 179, 195/);
  assert.doesNotMatch(pdf, /1\.00 ppm|NaN|null ppm|undefined/);
});

test('official-time continuous pH and Nitrite colors reach persisted Result, History, PDF, and Map values', async () => {
  const { app, persistedRecords } = await createComputedResultTestApp();
  const image = await createDeveloperRoiImage([186, 178, 142], [191, 172, 188]);
  const response = await submitDeveloperImage(app, image, {
    sampleClass: 'A',
    sampleCode: 'A-05',
    gpsLatitude: 14.6,
    gpsLongitude: 120.98,
    capturedAt: '2026-10-04T00:00:00.000Z',
  });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(response.body.pHResult.measuredRGB, [186, 178, 142]);
  assert.deepEqual(response.body.nitrite.measuredRGB, [191, 172, 188]);
  assert.ok(Math.abs(response.body.pH - 7.390968644738416) < 1e-9);
  assert.equal(response.body.pHResult.matchMethod, 'official-time-continuous-lab-ridge-quadratic');
  assert.equal(response.body.pHResult.exactValue, null);
  assert.equal(response.body.nitrite.value, 0.5);
  assert.equal(response.body.nitriteClassificationStatus, 'Warning');
  assert.equal(response.body.resultData.pH, '7.4');
  assert.equal(response.body.resultData.Nitrite, '0.50 ppm');
  assert.equal(response.body.resultData['Nitrite Status'], 'Warning');
  assert.equal(persistedRecords[0].estimatedPH, response.body.pH);
  assert.equal(persistedRecords[0].estimatedNitrite, 0.5);
  assert.equal(persistedRecords[0].analysisData.nitrite.classificationStatus, 'Warning');

  const resultView = toScanResult(response.body, 'https://aquality-api.example.test/api');
  const historyRecord = serializeWaterTest(persistedRecords[0]);
  const historyView = toScanResult(historyRecord, 'https://aquality-api.example.test/api');
  assert.equal(resultView.resultData.pH, historyView.resultData.pH);
  assert.equal(resultView.resultData.Nitrite, historyView.resultData.Nitrite);
  assert.equal(resultView.resultData['Nitrite Status'], historyView.resultData['Nitrite Status']);
  assert.equal(resultView.resultData.pH, '7.4');
  assert.equal(resultView.resultData.Nitrite, '0.5 ppm');
  assert.equal(resultView.resultData['Nitrite Status'], 'Warning');
  assert.equal(resultView.resultData['pH Category'], 'Alkaline');
  assert.deepEqual(Object.keys(resultView.resultData), ['pH', 'pH Category', 'Nitrite', 'Nitrite Status']);

  const pdf = buildPdfHtml({ test: historyView });
  assert.match(pdf, /pH:<\/strong> 7\.4/);
  assert.match(pdf, /Nitrite:<\/strong> 0\.5 ppm/);
  assert.match(pdf, /Nitrite Status:<\/strong> Warning/);
  assert.doesNotMatch(pdf, /Measured Parameters Status|Awaiting approved limits|Overall Water Status/);
  const marker = toMapMarker({
    id: historyRecord.id,
    latitude: 14.6,
    longitude: 120.98,
    sampleClass: 'A',
    siteName: 'Well',
    pH: historyRecord.pH,
    nitrite: historyRecord.nitrite,
    resultData: historyRecord.resultData,
  });
  assert.equal(marker.pH, historyRecord.pH);
  assert.equal(marker.nitriteDisplay, '0.5 ppm');
  assert.equal(marker.nitriteStatus, 'Warning');
});

test('the same scanned image keeps its computed pH and Nitrite across sample classes and GPS coordinates', async () => {
  const { app, persistedRecords, engineCalls } = await createComputedResultTestApp();
  const image = await createDeveloperRoiImage([186, 178, 142], [183, 172, 180]);
  const capturedAt = '2026-10-04T00:00:00.000Z';
  const classCases = [
    { sampleClass: 'SA', sampleCode: 'SA-01', gpsLatitude: 14.6, gpsLongitude: 120.98 },
    { sampleClass: 'A', sampleCode: 'A-01', gpsLatitude: 14.6, gpsLongitude: 120.98 },
    { sampleClass: 'SB', sampleCode: 'SB-01', gpsLatitude: 14.6, gpsLongitude: 120.98 },
  ];
  const classResponses = [];
  for (const metadata of classCases) {
    const response = await submitDeveloperImage(app, image, { ...metadata, capturedAt });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    classResponses.push(response);
  }

  assert.deepEqual(classResponses.map(({ body }) => body.sampleClass), ['SA', 'A', 'SB']);
  assert.deepEqual(classResponses.map(({ body }) => body.siteName), ['Pawikan', 'Well', 'Fish Farm']);
  assert.deepEqual(chemistrySnapshot(classResponses[0]), chemistrySnapshot(classResponses[1]));
  assert.deepEqual(chemistrySnapshot(classResponses[1]), chemistrySnapshot(classResponses[2]));
  assert.ok(classResponses[1].body.pH >= 7.22 && classResponses[1].body.pH <= 8.21);
  assert.equal(classResponses[1].body.pHResult.matchMethod, 'official-time-continuous-lab-ridge-quadratic');
  assert.equal(classResponses[1].body.nitrite.value, 0);
  assert.equal(classResponses[1].body.nitriteClassificationStatus, 'Safe');

  const gpsChanged = await submitDeveloperImage(app, image, {
    ...classCases[1],
    gpsLatitude: -33.8688,
    gpsLongitude: 151.2093,
    capturedAt,
  });
  assert.equal(gpsChanged.status, 201, JSON.stringify(gpsChanged.body));
  assert.notDeepEqual(gpsChanged.body.gps, classResponses[1].body.gps);
  assert.deepEqual(chemistrySnapshot(gpsChanged), chemistrySnapshot(classResponses[1]));
  assert.deepEqual(gpsChanged.body.resultData, classResponses[1].body.resultData);

  assert.equal(persistedRecords.length, 4);
  assert.equal(engineCalls.length, 4);
  for (const call of engineCalls) {
    assert.deepEqual(call.keys, ['debugLogger', 'imagePath']);
    assert.ok(call.imagePath);
  }
  for (const record of persistedRecords) {
    assert.equal(record.estimatedPH, classResponses[1].body.pH);
    assert.equal(record.estimatedNitrite, 0);
    assert.deepEqual(record.analysisData.pH.measuredRGB, [186, 178, 142]);
    assert.deepEqual(record.analysisData.nitrite.measuredRGB, [183, 172, 180]);
    assert.equal(record.analysisData.nitrite.classificationStatus, 'Safe');
  }
});

test('the exact 1 ppm Nitrite reference receives Dangerous status and persists it', async () => {
  const { app, persistedRecords } = await createComputedResultTestApp();
  const image = await createDeveloperRoiImage([168, 133, 122], [193, 172, 173]);
  const response = await submitDeveloperImage(app, image, { capturedAt: '2026-10-04T00:00:00.000Z' });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.nitrite.value, 1);
  assert.equal(response.body.nitriteClassificationStatus, 'Dangerous');
  assert.equal(response.body.resultData['Nitrite Status'], 'Dangerous');
  assert.equal(persistedRecords[0].analysisData.nitrite.classificationStatus, 'Dangerous');
});

test('a scan with successful pH and unavailable Nitrite reports only the Nitrite limitation', async () => {
  const { app } = await createComputedResultTestApp();
  const image = await createDeveloperRoiImage([186, 178, 142], [155, 144, 120]);
  const response = await submitDeveloperImage(app, image, {
    sampleClass: 'SB',
    sampleCode: 'SB-09',
    gpsLatitude: 14.6,
    gpsLongitude: 120.98,
    capturedAt: '2026-10-04T00:00:00.000Z',
  });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  const resultView = toScanResult(response.body, 'https://aquality-api.example.test/api');
  assert.equal(resultView.resultData['pH Category'], 'Alkaline');
  assert.equal(resultView.resultData.Nitrite, 'No reference match');
  assert.equal(resultView.resultData['Nitrite Status'], 'Unavailable');
  assert.deepEqual(Object.keys(resultView.resultData), ['pH', 'pH Category', 'Nitrite', 'Nitrite Status']);
  assert.equal(resultView.summary, 'Nitrite color did not match the configured reference levels.');
});

test('changing only sensing-zone RGB changes results under fixed metadata, and unsupported colors stay unavailable', async () => {
  const { app, persistedRecords } = await createComputedResultTestApp();
  const metadata = {
    sampleClass: 'A',
    sampleCode: 'A-05',
    gpsLatitude: 14.71,
    gpsLongitude: 120.91,
    capturedAt: '2026-10-04T00:00:00.000Z',
  };
  const imageCases = [
    { pHRgb: [186, 178, 142], nitriteRgb: [183, 172, 180], expectedNitrite: 0 },
    { pHRgb: [182, 163, 118], nitriteRgb: [190, 172, 187], expectedNitrite: 0.5 },
    { pHRgb: [150, 147, 123], nitriteRgb: [155, 144, 120], expectedPH: null, expectedNitrite: null },
  ];
  const responses = [];
  for (const imageCase of imageCases) {
    const image = await createDeveloperRoiImage(imageCase.pHRgb, imageCase.nitriteRgb);
    const response = await submitDeveloperImage(app, image, metadata);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    responses.push(response);
    assert.deepEqual(response.body.pHResult.measuredRGB, imageCase.pHRgb);
    assert.deepEqual(response.body.nitrite.measuredRGB, imageCase.nitriteRgb);
    if (imageCase.expectedPH === null) assert.equal(response.body.pH, null);
    else assert.ok(response.body.pH >= 7.22 && response.body.pH <= 8.21);
    assert.equal(response.body.nitrite.value, imageCase.expectedNitrite);
  }

  assert.notDeepEqual(responses[0].body.pHResult.measuredRGB, responses[1].body.pHResult.measuredRGB);
  assert.notEqual(responses[0].body.pH, responses[1].body.pH);
  assert.notDeepEqual(responses[0].body.nitrite.measuredRGB, responses[1].body.nitrite.measuredRGB);
  assert.equal(responses[0].body.resultData.pH, '7.4');
  assert.equal(responses[0].body.resultData.Nitrite, '0.00 ppm');
  assert.equal(responses[1].body.resultData.pH, '8.0');
  assert.equal(responses[1].body.resultData.Nitrite, '0.50 ppm');
  assert.equal(responses[2].body.resultData.pH, 'No reference match');
  assert.equal(responses[2].body.resultData.Nitrite, 'No reference match');
  assert.deepEqual(responses.map(({ body }) => [body.sampleClass, body.sampleCode, body.gps]), [
    ['A', 'A-05', { latitude: 14.71, longitude: 120.91 }],
    ['A', 'A-05', { latitude: 14.71, longitude: 120.91 }],
    ['A', 'A-05', { latitude: 14.71, longitude: 120.91 }],
  ]);
  assert.deepEqual(persistedRecords.map(({ estimatedPH, estimatedNitrite }) => [estimatedPH, estimatedNitrite]), [
    [responses[0].body.pH, 0],
    [responses[1].body.pH, 0.5],
    [null, null],
  ]);
});
