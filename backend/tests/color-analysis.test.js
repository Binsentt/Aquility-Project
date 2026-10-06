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
    [168, 133, 122],
    [173, 138, 133],
    [169, 130, 115],
    [166, 125, 125],
  ];
  expected.forEach((rgb, index) => {
    const match = matchPHClientRgbRange(rgb, calibration.pH.clientRgbRanges);
    assert.equal(match.reference.value, index + 1);
    assert.equal(match.status, 'EXACT_IN_RANGE');
    assert.equal(match.provisional, true);
  });
  calibration.pH.clientRgbRanges.forEach((reference) => {
    const rgb = ['r', 'g', 'b'].map((channel) => reference.rgbRange[channel][0]);
    assert.equal(matchPHClientRgbRange(rgb, calibration.pH.clientRgbRanges).reference.value, reference.value);
  });
  assert.equal(calibration.pH.references.find(({ label }) => label === '0-4').exactValue, null);
});

test('pH RGB range matching rejects unsupported pH 0 and ambiguous/unrelated colors', async () => {
  const calibration = await readBaseCalibration();
  assert.equal(matchPHClientRgbRange([150, 120, 100], calibration.pH.clientRgbRanges), null);
  assert.equal(matchPHClientRgbRange([170.5, 135.5, 128], calibration.pH.clientRgbRanges), null);
  assert.equal(calibration.pH.references.find(({ label }) => label === '0-4').exactValue, null);
  assert.equal(calibration.pH.references.find(({ label }) => label === '10-14').exactValue, null);
});

test('computed pH matching accepts configured centroids and nearby unambiguous colors only', async () => {
  const calibration = await readBaseCalibration();
  const { matchPHClientColor } = await import('../utils/colorAnalysis.js');
  assert.equal(typeof matchPHClientColor, 'function');

  const centroid = (reference) => ['r', 'g', 'b'].map((channel) => {
    const [first, second] = reference.rgbRange[channel];
    return (Math.min(first, second) + Math.max(first, second)) / 2;
  });
  const references = calibration.pH.clientRgbRanges;
  const centers = references.map(centroid);
  for (const [index, rgb] of centers.entries()) {
    const result = matchPHClientColor(rgb, references);
    assert.equal(result.accepted, true);
    assert.equal(result.reference.value, index + 1);
    assert.equal(result.diagnostics.reason, 'EXACT_RGB_RANGE_MATCH');
  }

  const perturbed = [
    { value: 1, rgb: [168, 133, 121] },
    { value: 2, rgb: [175.1, 138, 133.5] },
    { value: 3, rgb: [168.9, 130.5, 114.5] },
    { value: 4, rgb: [167.1, 125.5, 125] },
  ];
  for (const sample of perturbed) {
    const result = matchPHClientColor(sample.rgb, references);
    assert.equal(result.accepted, true, JSON.stringify(result.diagnostics));
    assert.equal(result.reference.value, sample.value);
    assert.equal(result.matchMethod, 'CIEDE2000_CENTROID_DISTANCE');
    assert.equal(result.diagnostics.distanceMetric, 'CIEDE2000');
    assert.ok(Number.isFinite(result.diagnostics.bestDistance));
    assert.ok(Number.isFinite(result.diagnostics.secondBestDistance));
    assert.ok(Number.isFinite(result.diagnostics.margin));
    assert.ok(Number.isFinite(result.diagnostics.candidateDistances[0].rgbEuclideanDistance));
    assert.ok(Number.isFinite(result.diagnostics.candidateDistances[0].normalizedChromaticDistance));
  }

  const midpoint = centers[0].map((value, index) => (value + centers[2][index]) / 2);
  const ambiguous = matchPHClientColor(midpoint, references);
  assert.equal(ambiguous.accepted, false);
  assert.equal(ambiguous.value, null);
  assert.ok(ambiguous.diagnostics.margin < ambiguous.diagnostics.minimumRequiredMargin);

  const unrelated = matchPHClientColor([255, 0, 0], references);
  assert.equal(unrelated.accepted, false);
  assert.equal(unrelated.value, null);
  assert.ok(unrelated.diagnostics.bestDistance > unrelated.diagnostics.acceptanceThreshold);

  const latestScan = matchPHClientColor([150, 147, 123], references);
  assert.equal(latestScan.accepted, false);
  assert.equal(latestScan.reference, null);
  assert.equal(latestScan.diagnostics.bestReference.label, '3');
  assert.equal(latestScan.diagnostics.secondBestReference.label, '1');
  assert.ok(latestScan.diagnostics.bestDistance > latestScan.diagnostics.acceptanceThreshold);
  assert.ok(latestScan.diagnostics.margin < latestScan.diagnostics.minimumRequiredMargin);
});

test('latest unmatched ROI colors and unlabeled client RGB samples do not force a calibration result', async () => {
  const calibration = await readBaseCalibration();
  const currentScan = {
    pH: [150, 147, 123],
    nitrite: [155, 144, 120],
  };
  assert.equal(matchPHClientRgbRange(currentScan.pH, calibration.pH.clientRgbRanges), null);
  assert.equal(matchNitriteClientRgbRange(currentScan.nitrite, calibration.nitrite.references).matchState, 'OUTSIDE_REFERENCE_SPACE');

  for (const unlabeledRgb of [[185, 188, 194], [180, 184, 188]]) {
    assert.equal(matchPHClientRgbRange(unlabeledRgb, calibration.pH.clientRgbRanges), null);
    assert.equal(matchNitriteClientRgbRange(unlabeledRgb, calibration.nitrite.references).matchState, 'OUTSIDE_REFERENCE_SPACE');
  }
});

test('pH colors just outside client RGB ranges remain unavailable without paired tolerance data', async () => {
  const calibration = await readBaseCalibration();
  const match = matchPHClientRgbRange([170, 136, 124], calibration.pH.clientRgbRanges);
  assert.equal(match, null);
});

test('analysis returns each provisional pH 1-4 value only when the ROI is inside its client RGB range', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-client-ph-ranges-'));
  try {
    const engine = createColorAnalysisEngine({
      readJson: async () => configuredCalibration(await readBaseCalibration()),
      allowDeveloperRoiFixture: true,
    });
    const references = [
      { value: 1, rgb: [168, 133, 122] },
      { value: 2, rgb: [173, 138, 133] },
      { value: 3, rgb: [169, 130, 115] },
      { value: 4, rgb: [166, 125, 125] },
    ];
    for (const reference of references) {
      const imagePath = join(directory, `pH-${reference.value}.png`);
      const pixels = Buffer.alloc(20 * 20 * 3);
      for (let y = 0; y < 20; y += 1) {
        for (let x = 0; x < 20; x += 1) {
          pixels.set(x < 10 ? reference.rgb : [190, 172, 187], (y * 20 + x) * 3);
        }
      }
      await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
      const result = await engine.analyze({ imagePath });
      assert.equal(result.pH.value, reference.value);
      assert.equal(result.pH.exactValue, reference.value);
      assert.equal(result.pH.rgbMatch.status, 'EXACT_IN_RANGE');
      assert.equal(result.pH.matchedReference.source, 'client-rgb-range');
      assert.equal(result.measuredParametersStatus, 'Not classified');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an exact client pH 1-4 RGB match is independent of the unset Lab threshold', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-client-ph-threshold-'));
  const imagePath = join(directory, 'pH-1-no-lab-threshold.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [168, 133, 122] : [190, 172, 187], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  try {
    const calibration = configuredCalibration(await readBaseCalibration());
    calibration.pH.maxDeltaE00 = null;
    const result = await createColorAnalysisEngine({
      readJson: async () => calibration,
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.equal(result.pH.value, 1);
    assert.equal(result.pH.exactValue, 1);
    assert.equal(result.pH.rgbMatch.status, 'EXACT_IN_RANGE');
    assert.equal(result.pH.reliabilityStatus, 'CLIENT_RGB_RANGE_MATCH');
    assert.equal(result.nitrite.value, 0.5);
    assert.equal(result.measuredParametersStatus, 'Not classified');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('official-time continuous pH colors bypass the narrow pH 1-4 RGB matcher', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-official-ph-color-'));
  const imagePath = join(directory, 'official-time-color.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [186, 178, 142] : [190, 172, 187], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  const calibration = configuredCalibration(await readBaseCalibration());
  calibration.pH.clientRgbRanges = [];
  calibration.pH.maxDeltaE00 = null;

  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => calibration,
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.pH.measuredRGB.join(','), '186,178,142');
    assert.ok(result.pH.value >= 7.22 && result.pH.value <= 8.21);
    assert.equal(result.pH.exactValue, null);
    assert.equal(result.pH.matchedReference, null);
    assert.equal(result.pH.matchMethod, 'official-time-continuous-lab-ridge-quadratic');
    assert.equal(result.pH.reliabilityStatus, 'OFFICIAL_TIME_CONTINUOUS_COLOR_MODEL');
    assert.equal(result.pH.calibrationModel.version, calibration.pH.continuousModel.version);
    assert.equal(result.nitrite.value, 0.5);
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
    assert.equal(result.nitrite.calibrationMetadata.source, 'CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST');
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

test('registered circular ROI sampling excludes corners outside the sensing area', () => {
  const pixels = Buffer.alloc(9 * 9 * 3);
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const dx = x + 0.5 - 4.5;
      const dy = y + 0.5 - 4.5;
      const isInnerSensingArea = dx ** 2 + dy ** 2 <= 2.4 ** 2;
      pixels.set(isInnerSensingArea ? [30, 40, 50] : [200, 20, 20], (y * 9 + x) * 3);
    }
  }

  const statistics = extractRoiStatistics(pixels, 9, 9, {
    x: 2 / 9,
    y: 2 / 9,
    width: 5 / 9,
    height: 5 / 9,
    shape: 'ellipse',
    center: { x: 0.5, y: 0.5 },
    radiusX: 2.5 / 9,
    radiusY: 2.5 / 9,
  });

  assert.deepEqual(statistics.measuredRGB, [30, 40, 50]);
  assert.ok(statistics.sampleCount < 25);
  assert.equal(statistics.statistic, 'per-channel-median-with-luminance-outlier-filter-and-ellipse-mask');
});

test('RGB to HSV extracts pink hue for the Griess nitrite response', () => {
  assert.ok(Math.abs(rgbToHsv([255, 64, 64]).hue - 0) < 0.001);
  assert.ok(Math.abs(rgbToHsv([255, 127.5, 63.75]).hue - 20) < 0.001);
});

test('direct Nitrite RGB calibration includes client 0, 0.5, 1, and qualified >1 ppm classes', async () => {
  const calibration = await readBaseCalibration();
  assert.equal(calibration.nitrite.source, 'CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST');
  assert.equal(calibration.nitrite.sourceNote, 'Real-phone µPAD Nitrite accuracy has not been established with labeled phone-camera samples. Non-accepted nearest-reference outputs are shown only as low-confidence reference estimates.');
  assert.equal(calibration.nitrite.referenceOrderDirection, 'left-to-right');
  assert.deepEqual(calibration.nitrite.referenceOrder, ['0', '0.5', '1', '>1']);
  assert.ok(calibration.nitrite.references.every((reference) => (
    reference.provenance === 'CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST'
  )));
  assert.deepEqual(calibration.nitrite.references.map(({ label, rgbRange }) => ({ label, rgbRange })), [
    { label: '0', rgbRange: { r: [182, 184], g: [171, 173], b: [179, 181] } },
    { label: '0.5', rgbRange: { r: [190, 190], g: [172, 172], b: [187, 188] } },
    { label: '1', rgbRange: { r: [193, 212], g: [172, 194], b: [173, 192] } },
    { label: '>1', rgbRange: { r: [196, 198], g: [178, 180], b: [194, 196] } },
  ]);
  assert.equal(calibration.nitrite.unit, 'ppm');
  assert.equal(calibration.nitrite.provisional, true);
  assert.equal(calibration.nitrite.huePoints, undefined);
  assert.equal(calibration.nitrite.ppmValues, undefined);
  assert.equal(calibration.nitrite.references.length, 4);
  const expected = [
    { rgb: [183, 172, 180], matchState: 'EXACT_OR_IN_RANGE', value: 0, displayValue: '0 ppm' },
    { rgb: [190, 172, 187], matchState: 'EXACT_OR_IN_RANGE', value: 0.5, displayValue: '0.5 ppm' },
    { rgb: [202, 183, 182], matchState: 'EXACT_OR_IN_RANGE', value: 1, displayValue: '1 ppm' },
    { rgb: [197, 179, 195], matchState: 'ABOVE_1_PPM', value: null, displayValue: '>1 ppm' },
  ];
  expected.forEach(({ rgb, matchState, value, displayValue }) => {
    const match = matchNitriteClientRgbRange(rgb, calibration.nitrite.references);
    assert.equal(match.matchState, matchState);
    assert.equal(match.value, value);
    assert.equal(match.displayValue, displayValue);
    assert.equal(match.provisional, true);
    assert.equal(match.unit, 'ppm');
    assert.equal(match.source, 'CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST');
  });
});

test('Nitrite >1 interval wins by complete RGB vector and never returns exact 1 ppm', async () => {
  const calibration = await readBaseCalibration();
  const references = calibration.nitrite.references;
  const aboveOne = matchNitriteClientRgbRange([197, 179, 195], references);
  const exactOne = matchNitriteClientRgbRange([197, 179, 192], references);

  assert.equal(aboveOne.matchState, 'ABOVE_1_PPM');
  assert.equal(aboveOne.value, null);
  assert.equal(aboveOne.displayValue, '>1 ppm');
  assert.equal(aboveOne.qualifier, '>');
  assert.equal(aboveOne.lowerBound, 1);
  assert.equal(exactOne.matchState, 'EXACT_OR_IN_RANGE');
  assert.equal(exactOne.value, 1);
  assert.equal(exactOne.displayValue, '1 ppm');
});

test('exact low-saturation client Nitrite reference is accepted from the measured ROI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-direct-nitrite-zero-'));
  const imagePath = join(directory, 'nitrite-zero.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [168, 133, 122] : [183, 172, 180], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => configuredCalibration(await readBaseCalibration()),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.deepEqual(result.nitrite.measuredRGB, [183, 172, 180]);
    assert.equal(result.nitrite.matchState, 'EXACT_OR_IN_RANGE');
    assert.equal(result.nitrite.value, 0);
    assert.equal(result.nitrite.displayValue, '0 ppm');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('engine reports the >1 ppm client class from the measured Nitrite ROI without exact numeric output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-nitrite-above-one-'));
  const imagePath = join(directory, 'nitrite-above-one.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      pixels.set(x < 10 ? [168, 133, 122] : [197, 179, 195], (y * 20 + x) * 3);
    }
  }
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);
  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => configuredCalibration(await readBaseCalibration()),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.deepEqual(result.nitrite.measuredRGB, [197, 179, 195]);
    assert.equal(result.nitrite.value, null);
    assert.equal(result.nitrite.matchState, 'ABOVE_1_PPM');
    assert.equal(result.nitrite.displayValue, '>1 ppm');
    assert.equal(result.nitrite.status, 'ABOVE_1_PPM');
    assert.equal(result.nitrite.lowerBound, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
        assert.equal(match.matchState, reference.qualifier === '>' ? 'ABOVE_1_PPM' : 'EXACT_OR_IN_RANGE');
        assert.equal(match.reference.value, reference.value);
        if (reference.qualifier === '>') {
          assert.equal(match.value, null);
          assert.equal(match.displayValue, '>1 ppm');
        }
        boundaryCount += 1;
      }
    }
  }
  assert.equal(boundaryCount, 24);
});

test('near, ambiguous, and outside Nitrite colors never invent a concentration', async () => {
  const calibration = await readBaseCalibration();
  const near = matchNitriteClientRgbRange([185, 174, 183], calibration.nitrite.references);
  assert.equal(near.matchState, 'OUTSIDE_REFERENCE_SPACE');
  assert.equal(near.value, null);

  const ambiguous = matchNitriteClientRgbRange([186.5, 172, 183.75], calibration.nitrite.references);
  assert.equal(ambiguous.matchState, 'OUTSIDE_REFERENCE_SPACE');
  assert.equal(ambiguous.value, null);

  for (const rgb of [[255, 0, 0], [255, 64, 64], [255, 0, 255], [0, 255, 0], [0, 0, 255], [20, 20, 20], [255, 255, 255]]) {
    const match = matchNitriteClientRgbRange(rgb, calibration.nitrite.references);
    assert.equal(match.matchState, 'OUTSIDE_REFERENCE_SPACE');
    assert.equal(match.value, null);
  }
});

test('computed Nitrite matching accepts configured centroids and nearby unambiguous colors only', async () => {
  const calibration = await readBaseCalibration();
  const { matchNitriteClientColor } = await import('../utils/colorAnalysis.js');
  assert.equal(typeof matchNitriteClientColor, 'function');

  const centroid = (reference) => ['r', 'g', 'b'].map((channel) => {
    const [first, second] = reference.rgbRange[channel];
    return (Math.min(first, second) + Math.max(first, second)) / 2;
  });
  const references = calibration.nitrite.references;
  for (const reference of references) {
    const result = matchNitriteClientColor(centroid(reference), references);
    assert.equal(result.accepted, true);
    assert.equal(result.reference.label, reference.label);
    if (reference.qualifier === '>') {
      assert.equal(result.value, null);
      assert.equal(result.displayValue, '>1 ppm');
      assert.equal(result.matchState, 'ABOVE_1_PPM');
    } else {
      assert.equal(result.value, reference.value);
    }
  }

  const perturbed = [
    { label: '0', rgb: [183, 172, 178.99] },
    { label: '0.5', rgb: [191, 172, 187.5] },
    { label: '1', rgb: [203, 183, 183] },
    { label: '>1', rgb: [197, 180, 195] },
  ];
  for (const sample of perturbed) {
    const result = matchNitriteClientColor(sample.rgb, references);
    assert.equal(result.accepted, true, JSON.stringify(result.diagnostics));
    assert.equal(result.reference.label, sample.label);
    assert.equal(result.matchMethod, result.diagnostics.reason === 'EXACT_RGB_RANGE_MATCH'
      ? 'RAW_RGB_INTERVAL'
      : 'COMPOSITE_REFERENCE_DISTANCE');
  }

  const centers = references.map(centroid);
  // This midpoint avoids the broad 1 ppm raw RGB interval, so the ambiguity
  // guard—not the intentionally strongest exact-interval path—is exercised.
  const lowerClassMidpoint = centers[0].map((value, index) => (value + centers[1][index]) / 2);
  const ambiguous = matchNitriteClientColor(lowerClassMidpoint, references);
  assert.equal(ambiguous.accepted, false);
  assert.equal(ambiguous.value, null);
  assert.ok(ambiguous.diagnostics.margin < ambiguous.diagnostics.minimumRequiredMargin);

  const unrelated = matchNitriteClientColor([255, 0, 0], references);
  assert.equal(unrelated.accepted, false);
  assert.equal(unrelated.value, null);
  assert.ok(unrelated.diagnostics.bestDistance > unrelated.diagnostics.acceptanceThreshold);

  const latestScan = matchNitriteClientColor([155, 144, 120], references);
  assert.equal(latestScan.accepted, false);
  assert.equal(latestScan.reference, null);
  assert.equal(latestScan.diagnostics.bestReference.label, '1');
  assert.equal(latestScan.diagnostics.secondBestReference.label, '0');
  assert.ok(latestScan.diagnostics.bestDistance > latestScan.diagnostics.acceptanceThreshold);
  assert.ok(latestScan.diagnostics.margin < latestScan.diagnostics.minimumRequiredMargin);
});

test('Nitrite composite matching rejects measurements with unavailable metrics', async () => {
  const calibration = await readBaseCalibration();
  const { matchNitriteClientColor } = await import('../utils/colorAnalysis.js');
  const result = matchNitriteClientColor([0, 0, 0], calibration.nitrite.references);

  assert.equal(result.accepted, false);
  assert.equal(result.diagnostics.withinReferenceFamily, false);
  assert.ok(result.diagnostics.candidateDistances.every((candidate) => (
    candidate.normalizedCompositeDistance === null
  )));
});

test('exact Nitrite RGB intervals preserve the four discrete client classes', async () => {
  const calibration = await readBaseCalibration();
  const { matchNitriteClientColor } = await import('../utils/colorAnalysis.js');
  const { classifyNitriteStatus } = await import('../services/measurementClassification.js');
  const cases = [
    { label: '0', rgb: [183, 172, 180], display: '0 ppm', value: 0, status: 'Safe' },
    { label: '0.5', rgb: [190, 172, 188], display: '0.5 ppm', value: 0.5, status: 'Warning' },
    { label: '1', rgb: [203, 183, 183], display: '1 ppm', value: 1, status: 'Dangerous' },
    { label: '>1', rgb: [197, 179, 195], display: '>1 ppm', value: null, status: 'Dangerous' },
  ];

  for (const expected of cases) {
    const result = matchNitriteClientColor(expected.rgb, calibration.nitrite.references, calibration.nitrite.matching);
    assert.equal(result.accepted, true, JSON.stringify(result.diagnostics));
    assert.equal(result.reference.label, expected.label);
    assert.equal(result.value, expected.value);
    assert.equal(result.displayValue, expected.display);
    assert.equal(classifyNitriteStatus({
      value: result.value,
      qualifier: result.qualifier,
      lowerBound: result.lowerBound,
    }), expected.status);
  }
});

test('computed Nitrite matching uses all color distances and accepts a clear real-camera color only', async () => {
  const calibration = await readBaseCalibration();
  const { matchNitriteClientColor } = await import('../utils/colorAnalysis.js');
  const references = calibration.nitrite.references;

  const realCameraColor = matchNitriteClientColor([169, 163, 161], references, calibration.nitrite.matching);
  assert.equal(realCameraColor.accepted, true, JSON.stringify(realCameraColor.diagnostics));
  assert.equal(realCameraColor.reference.label, '0');
  assert.equal(realCameraColor.displayValue, '0 ppm');
  assert.equal(realCameraColor.matchMethod, 'COMPOSITE_REFERENCE_DISTANCE');
  assert.deepEqual(
    realCameraColor.diagnostics.metricsUsed,
    ['CIEDE2000', 'RGB_EUCLIDEAN', 'NORMALIZED_CHROMATIC_RGB'],
  );
  assert.ok(realCameraColor.diagnostics.margin >= realCameraColor.diagnostics.minimumRequiredMargin);

  const unrelated = matchNitriteClientColor([255, 0, 0], references, calibration.nitrite.matching);
  assert.equal(unrelated.accepted, false);
  assert.equal(unrelated.reference, null);
  assert.equal(unrelated.matchState, 'OUTSIDE_REFERENCE_SPACE');
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
        message: 'The square and triangle references and both circular sensing areas could not be detected clearly. Please keep the full µPAD visible and capture a sharp top-view image.',
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

test('valid ROIs reject unsupported pH colors outside the official camera domain', async () => {
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
    const result = await createColorAnalysisEngine({
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
      }).analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.equal(result.pH.value, null);
    assert.equal(result.phStatus, 'PH_MEASUREMENT_UNRELIABLE');
    assert.equal(result.pH.reliabilityStatus, 'COLOR_OUTSIDE_CALIBRATED_DOMAIN');
    assert.equal(result.nitrite.value, null);
    assert.equal(result.nitriteStatus, 'Unavailable');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('grouped pH 0-4 reference never becomes a user-facing measured result', async () => {
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
  calibration.pH.clientRgbRanges = [];

  try {
    const result = await createColorAnalysisEngine({
      readJson: async () => ({ ...configuredCalibration(calibration), pH: { ...calibration.pH, maxDeltaE00: 100 } }),
      allowDeveloperRoiFixture: true,
    }).analyze({ imagePath });

    assert.equal(result.pH.value, null);
    assert.equal(result.pH.exactValue, null);
    assert.equal(result.pH.matchedReference, null);
    assert.notEqual(result.pH.value, '0-4');
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
    assert.equal(result.nitrite.status, 'Unavailable');
    assert.equal(result.nitriteStatus, 'Unavailable');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
