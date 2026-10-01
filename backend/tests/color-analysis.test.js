import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  deltaE00,
  extractRoiStatistics,
  matchNitriteClientRgbRange,
  matchPHClientRgbRange,
  matchPHReference,
  rgbToHsv,
  rgbToLab,
} from '../utils/colorAnalysis.js';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

async function readBaseCalibration() {
  return JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../database/colorAnalysisCalibration.json', import.meta.url), 'utf8'
  ));
}

function configuredCalibration(baseCalibration) {
  return {
    ...baseCalibration,
    pH: {
      ...baseCalibration.pH,
      // Developer fixture threshold only. No production threshold is approved.
      maxDeltaE00: 100,
    },
    roi: {
      ...baseCalibration.roi,
      productionAllowed: false,
      registration: { ...baseCalibration.roi.registration, enabled: false },
      // Synthetic developer fixture only. These coordinates are not a claim
      // about the client's physical strip geometry.
      regions: {
        pH: { x: 0, y: 0, width: 0.5, height: 1 },
        nitrite: { x: 0.5, y: 0, width: 0.5, height: 1 },
      },
    },
  };
}

test('RGB converts to CIE Lab using the sRGB D65 reference white', () => {
  const white = rgbToLab([255, 255, 255]);
  const black = rgbToLab([0, 0, 0]);

  assert.ok(Math.abs(white[0] - 100) < 0.01);
  assert.ok(Math.abs(white[1]) < 0.01);
  assert.ok(Math.abs(white[2]) < 0.01);
  assert.deepEqual(black, [0, 0, 0]);
});

test('CIEDE2000 matches published Sharma reference pairs', () => {
  assert.ok(Math.abs(deltaE00([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 0.0001);
  assert.ok(Math.abs(deltaE00([50, 3.1571, -77.2803], [50, 0, -82.7485]) - 2.8615) < 0.0001);
  assert.ok(Math.abs(deltaE00([50, 2.8361, -74.02], [50, 0, -82.7485]) - 3.4412) < 0.0001);
  assert.equal(deltaE00([50, 0, 0], [50, 0, 0]), 0);
});

test('pH color matching selects the closest supplied Lab reference', async () => {
  const calibration = JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../database/colorAnalysisCalibration.json', import.meta.url), 'utf8'
  ));
  const matched = matchPHReference(calibration.pH.references[2].lab, calibration.pH.references);

  assert.equal(matched.reference.label, '6');
  assert.equal(matched.deltaE00, 0);
  assert.equal(calibration.pH.references[0].value, '0-4');
  assert.equal(calibration.pH.references[0].exactValue, null);
});

test('pH matching preserves range references without inventing an exact value', () => {
  const references = [
    { label: '0-4', value: '0-4', exactValue: null, lab: [50.9, 66.5, 54] },
    { label: '5', value: 5, exactValue: 5, lab: [65.4, 36.1, 68.7] },
  ];

  const match = matchPHReference(references[0].lab, references, { maxDeltaE00: 1 });

  assert.equal(match.reference.value, '0-4');
  assert.equal(match.reference.exactValue, null);
  assert.equal(match.reliabilityStatus, 'RELIABLE_WITHIN_PROVISIONAL_THRESHOLD');

  const alkaline = { label: '10-14', value: '10-14', exactValue: null, lab: [33.4, 51.3, -44.4] };
  assert.equal(matchPHReference(alkaline.lab, [...references, alkaline], { maxDeltaE00: 1 }).reference.value, '10-14');
  assert.equal(alkaline.exactValue, null);
});

test('pH matching rejects a poor color match when a provisional threshold is configured', () => {
  const match = matchPHReference([163, 1.3, -2.4], [
    { label: '8', value: 8, exactValue: 8, lab: [49.7, -23.8, -13.4] },
  ], { maxDeltaE00: 5 });

  assert.equal(match, null);
});

test('acidic, neutral, and basic reference colors do not collapse to one pH value', () => {
  const references = [
    { label: 'acid', value: '0-4', exactValue: null, lab: rgbToLab([230, 180, 50]) },
    { label: 'neutral', value: 7, exactValue: 7, lab: rgbToLab([120, 190, 80]) },
    { label: 'basic', value: 8, exactValue: 8, lab: rgbToLab([80, 100, 180]) },
  ];

  assert.equal(matchPHReference(rgbToLab([230, 180, 50]), references, { maxDeltaE00: 1 }).reference.label, 'acid');
  assert.equal(matchPHReference(rgbToLab([120, 190, 80]), references, { maxDeltaE00: 1 }).reference.label, 'neutral');
  assert.equal(matchPHReference(rgbToLab([80, 100, 180]), references, { maxDeltaE00: 1 }).reference.label, 'basic');
});

test('client pH 1-4 RGB ranges match provisional exact values from ROI medians', async () => {
  const calibration = await readBaseCalibration();
  assert.deepEqual(calibration.pH.clientRgbRanges.map(({ label }) => label), ['1', '2', '3', '4']);
  assert.deepEqual(calibration.pH.clientRgbRanges[0].rgbRange, { r: [167, 169], g: [132, 134], b: [122, 123] });
  assert.deepEqual(calibration.pH.clientRgbRanges[2].sourceRgbRange.b, [116, 113]);
  assert.equal(calibration.pH.clientRgbRanges[2].normalizedSourceOrder, 'min=113,max=116');
  assert.deepEqual(calibration.pH.clientRgbRanges[3].rgbRange, { r: [166, 167], g: [124, 127], b: [123, 127] });
  const expected = [
    [168, 133, 122.5],
    [173, 138, 133.5],
    [169, 130.5, 114.5],
    [166.5, 125.5, 125],
  ];
  expected.forEach((rgb, index) => {
    const match = matchPHClientRgbRange(rgb, calibration.pH.clientRgbRanges, { tolerance: 8 });
    assert.equal(match.reference.value, index + 1);
    assert.equal(match.status, 'EXACT_IN_RANGE');
    assert.equal(match.provisional, true);
  });
  calibration.pH.clientRgbRanges.forEach((reference) => {
    const rgb = ['r', 'g', 'b'].map((channel) => reference.rgbRange[channel][0]);
    assert.equal(matchPHClientRgbRange(rgb, calibration.pH.clientRgbRanges, { tolerance: 8 }).reference.value, reference.value);
  });
  assert.equal(calibration.pH.references.find(({ label }) => label === '0-4').exactValue, null);
});

test('pH RGB range matching rejects unsupported pH 0 and ambiguous/unrelated colors', async () => {
  const calibration = await readBaseCalibration();
  assert.equal(matchPHClientRgbRange([150, 120, 100], calibration.pH.clientRgbRanges, { tolerance: 2 }), null);
  assert.equal(matchPHClientRgbRange([170.5, 135.5, 128], calibration.pH.clientRgbRanges, { tolerance: 8, ambiguityMargin: 0.8 }), null);
  assert.equal(calibration.pH.references.find(({ label }) => label === '0-4').exactValue, null);
  assert.equal(calibration.pH.references.find(({ label }) => label === '10-14').exactValue, null);
});

test('slightly outside pH RGB ranges are reported as provisional near matches', async () => {
  const calibration = await readBaseCalibration();
  const match = matchPHClientRgbRange([170, 136, 124], calibration.pH.clientRgbRanges, { tolerance: 8 });
  assert.equal(match.reference.value, 1);
  assert.equal(match.status, 'NEAR_RANGE');
  assert.equal(match.provisional, true);
});

test('analysis returns provisional pH 1-4 values only when the registered ROI matches the client RGB ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-client-ph-ranges-'));
  const imagePath = join(directory, 'pH-1.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [168, 133, 123] : [255, 64, 64], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => configuredCalibration(await readBaseCalibration()),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });
    assert.equal(result.pH.value, 1);
    assert.equal(result.pH.exactValue, 1);
    assert.equal(result.pH.rgbMatch.status, 'EXACT_IN_RANGE');
    assert.equal(result.pH.matchedReference.source, 'client-rgb-range');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('analysis uses the registered Nitrite ROI and direct RGB classes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-direct-nitrite-'));
  const imagePath = join(directory, 'nitrite-05.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [230, 180, 50] : [190, 172, 188], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => ({
        ...configuredCalibration(await readBaseCalibration()),
        nitrite: { ...(await readBaseCalibration()).nitrite },
      }),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });
    assert.equal(result.nitrite.value, 0.5);
    assert.equal(result.nitrite.matchState, 'EXACT_OR_IN_RANGE');
    assert.equal(result.nitrite.matchingMethod, 'direct-client-rgb-range');
    assert.equal(result.nitrite.calibrationMetadata.source, 'CLIENT_DIRECT_NITRITE_RGB');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ROI extracts median RGB across a crop and rejects a luminance outlier', () => {
  const pixels = Buffer.alloc(4 * 4 * 3);
  for (let index = 0; index < 16; index += 1) pixels.set([100, 120, 140], index * 3);
  pixels.set([255, 255, 255], (1 * 4 + 1) * 3);
  const statistics = extractRoiStatistics(pixels, 4, 4, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });

  assert.deepEqual(statistics.measuredRGB, [100, 120, 140]);
  assert.equal(statistics.sampleCount, 3);
  assert.deepEqual(statistics.roiPixels, { left: 1, top: 1, width: 2, height: 2 });
});

test('RGB to HSV extracts pink hue for the Griess nitrite response', () => {
  assert.ok(Math.abs(rgbToHsv([255, 64, 64]).hue - 0) < 0.001);
  assert.ok(Math.abs(rgbToHsv([255, 127.5, 63.75]).hue - 20) < 0.001);
});

test('direct Nitrite RGB calibration matches only the three supplied provisional classes', async () => {
  const calibration = await readBaseCalibration();
  assert.equal(calibration.nitrite.source, 'CLIENT_DIRECT_NITRITE_RGB');
  assert.equal(calibration.nitrite.unit, 'ppm');
  assert.equal(calibration.nitrite.provisional, true);
  assert.equal(calibration.nitrite.huePoints, undefined);
  assert.equal(calibration.nitrite.ppmValues, undefined);
  assert.equal(calibration.nitrite.references.length, 3);
  const expected = [[183, 172, 180], [190, 172, 187.5], [202, 183, 182]];
  expected.forEach((rgb, index) => {
    const match = matchNitriteClientRgbRange(rgb, calibration.nitrite.references);
    assert.equal(match.matchState, 'EXACT_OR_IN_RANGE');
    assert.equal(match.reference.value, [0, 0.5, 1][index]);
    assert.equal(match.provisional, true);
    assert.equal(match.unit, 'ppm');
  });
});

test('direct Nitrite RGB matching includes every supplied boundary', async () => {
  const calibration = await readBaseCalibration();
  const midpoint = (range) => (range[0] + range[1]) / 2;
  let boundaryCount = 0;
  for (const reference of calibration.nitrite.references) {
    for (const channel of ['r', 'g', 'b']) {
      for (const endpoint of reference.rgbRange[channel]) {
        const rgb = ['r', 'g', 'b'].map((name) => name === channel ? endpoint : midpoint(reference.rgbRange[name]));
        const match = matchNitriteClientRgbRange(rgb, calibration.nitrite.references);
        assert.equal(match.matchState, 'EXACT_OR_IN_RANGE');
        assert.equal(match.reference.value, reference.value);
        boundaryCount += 1;
      }
    }
  }
  assert.equal(boundaryCount, 18);
});

test('near, ambiguous, and outside Nitrite colors never invent a concentration', async () => {
  const calibration = await readBaseCalibration();
  const near = matchNitriteClientRgbRange([185, 174, 183], calibration.nitrite.references, { nearChannelTolerance: 8, nearDistance: 18 });
  assert.equal(near.matchState, 'NEAR_REFERENCE');
  assert.equal(near.reference.value, 0);

  const ambiguous = matchNitriteClientRgbRange([186.5, 172, 183.75], calibration.nitrite.references, { nearChannelTolerance: 8, nearDistance: 18, ambiguityDistance: 2 });
  assert.equal(ambiguous.matchState, 'AMBIGUOUS');
  assert.equal(ambiguous.value, null);

  for (const rgb of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [20, 20, 20], [255, 255, 255]]) {
    const match = matchNitriteClientRgbRange(rgb, calibration.nitrite.references);
    assert.equal(match.matchState, 'OUTSIDE_REFERENCE_SPACE');
    assert.equal(match.value, null);
  }
});

test('analysis refuses numeric output when physical strip ROIs are not configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-color-analysis-'));
  const imagePath = join(directory, 'sample.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let index = 0; index < 400; index += 1) pixels.set([255, 128, 64], index * 3);
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const diagnostics = [];
    await assert.rejects(
      () => createColorAnalysisEngine().analyze({ imagePath, debugLogger: (stage, details) => diagnostics.push({ stage, details }) }),
      {
        code: 'STRIP_REGISTRATION_FAILED',
        status: 422,
        message: 'The test strip could not be registered. Please capture a clear top-view image with the reference point and both detection zones visible.',
      },
    );
    const registrationFailure = diagnostics.find(({ stage }) => stage === 'strip-registration-failed');
    assert.deepEqual(registrationFailure.details.roiDetected, { pH: false, nitrite: false });
    assert.equal(registrationFailure.details.referenceDetected, false);
    assert.equal(registrationFailure.details.registrationStatus, 'STRIP_REGISTRATION_FAILED');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('analysis decodes every image format accepted by the upload middleware', async () => {
  sharp.cache({ files: 0 });
  const directory = await mkdtemp(join(tmpdir(), 'aquility-image-formats-'));
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [255, 128, 64] : [64, 128, 255], (y * 20 + x) * 3);
    }
  }
  const engine = createColorAnalysisEngine({
    readJson: async () => configuredCalibration(await readBaseCalibration()),
    allowDeveloperRoiFixture: true,
  });

  try {
    for (const [extension, encode] of [
      ['jpg', (image) => image.jpeg({ quality: 100 })],
      ['png', (image) => image.png()],
      ['webp', (image) => image.webp({ quality: 100 })],
    ]) {
      const imagePath = join(directory, `sample.${extension}`);
      await encode(sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } })).toFile(imagePath);
      const result = await engine.analyze({ imagePath });
      assert.equal(result.nitrite.measuredRGB.length, 3);
      assert.ok(result.pH.deltaE00 >= 0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('analysis returns a strip-format error when Sharp cannot decode the upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-invalid-image-'));
  const imagePath = join(directory, 'corrupt.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));

  try {
    await assert.rejects(
      () => createColorAnalysisEngine().analyze({ imagePath }),
      { code: 'INVALID_STRIP_FORMAT', status: 422, message: 'Test strip not detected. Please capture a clear JPEG, PNG, or WebP image of the water-test strip.' }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('analysis uses separate configured pad ROIs instead of one shared center crop', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-separate-rois-'));
  const imagePath = join(directory, 'sample.png');
  const pixels = Buffer.alloc(20 * 20 * 3, 0);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      const color = x < 10 ? [255, 128, 64] : [64, 128, 255];
      pixels.set(color, (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const baseCalibration = await readBaseCalibration();
    const diagnostics = [];
    const result = await createColorAnalysisEngine({
      readJson: async () => configuredCalibration(baseCalibration),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath, debugLogger: (stage, details) => diagnostics.push({ stage, details }) });

    assert.notDeepEqual(result.pH.measuredRGB, result.nitrite.measuredRGB);
    assert.notDeepEqual(result.pH.roi.pixels, result.nitrite.roi.pixels);
    assert.equal(result.pH.roi.strategy, 'configured-normalized-roi');
    assert.equal(result.nitrite.roi.strategy, 'configured-normalized-roi');
    const nitriteDiagnostics = diagnostics.find(({ stage }) => stage === 'nitrite-diagnostics');
    assert.deepEqual(nitriteDiagnostics.details.nitriteRoiPixels, result.nitrite.roi.pixels);
    assert.deepEqual(nitriteDiagnostics.details.medianRGB, result.nitrite.measuredRGB);
    assert.equal(nitriteDiagnostics.details.clamped, result.nitrite.clamped);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gray/background sensing colors are rejected instead of becoming pH 8', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-gray-analysis-'));
  const imagePath = join(directory, 'gray.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let index = 0; index < 400; index += 1) pixels.set([163, 162, 167], index * 3);
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    await assert.rejects(
      () => createColorAnalysisEngine({
        readJson: async () => configuredCalibration(await readBaseCalibration()),
        allowDeveloperRoiFixture: true,
      }).analyze({ imagePath }),
      { code: 'IMAGE_QUALITY_INSUFFICIENT', status: 422 },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('valid ROIs still fail closed when no pH confidence threshold is configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-pH-threshold-'));
  const imagePath = join(directory, 'threshold-missing.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [230, 180, 50] : [255, 64, 64], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    await assert.rejects(
      () => createColorAnalysisEngine({
        readJson: async () => ({
          ...await readBaseCalibration(),
          roi: {
            ...(await readBaseCalibration()).roi,
            productionAllowed: false,
            registration: { ...(await readBaseCalibration()).roi.registration, enabled: false },
            regions: { pH: { x: 0, y: 0, width: 0.5, height: 1 }, nitrite: { x: 0.5, y: 0, width: 0.5, height: 1 } },
          },
        }),
        allowDeveloperRoiFixture: true,
      }).analyze({ imagePath }),
      { code: 'PH_MEASUREMENT_UNRELIABLE', status: 422 },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('pH range references remain labels instead of invented exact values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-range-analysis-'));
  const imagePath = join(directory, 'strong-acid.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [230, 180, 50] : [255, 64, 64], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  const calibration = await readBaseCalibration();
  calibration.pH.references = [
    { label: '0-4', value: '0-4', exactValue: null, lab: rgbToLab([230, 180, 50]) },
  ];

  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => ({ ...configuredCalibration(calibration), pH: { ...calibration.pH, maxDeltaE00: 100 } }),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.pH.value, '0-4');
    assert.equal(result.pH.exactValue, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('nitrite out-of-range colors do not become exact 100 ppm', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-nitrite-range-'));
  const imagePath = join(directory, 'out-of-range.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [230, 180, 50] : [64, 128, 255], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => configuredCalibration(await readBaseCalibration()),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.nitrite.value, null);
    assert.equal(result.nitrite.value, null);
    assert.equal(result.nitrite.status, 'NITRITE_OUTSIDE_CALIBRATION_RANGE');
    assert.equal(result.nitriteStatus, 'NITRITE_OUTSIDE_CALIBRATION_RANGE');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
