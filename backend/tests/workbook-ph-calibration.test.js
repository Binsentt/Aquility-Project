import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import * as colorAnalysis from '../utils/colorAnalysis.js';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

const calibration = JSON.parse(await readFile(
  new URL('../database/colorAnalysisCalibration.json', import.meta.url),
  'utf8',
));
const workbook = JSON.parse(await readFile(
  new URL('../database/calibration_sources/app-calibrate-1-extracted.json', import.meta.url),
  'utf8',
));

test('workbook pH references support individual classes and preserve the grouped 9-14 reference', () => {
  assert.equal(typeof colorAnalysis.matchPHWorkbookSamples, 'function');
  const references = calibration.pH.workbookCalibration.references;
  assert.equal(references.length, 9);

  const phOne = references.find((reference) => reference.label === '1');
  const phOneResult = colorAnalysis.matchPHWorkbookSamples(phOne.samples[0], references);
  assert.equal(phOneResult.accepted, true);
  assert.equal(phOneResult.value, 1);
  assert.equal(phOneResult.groupedReference, false);

  const grouped = references.find((reference) => reference.label === '9-14');
  const groupedResult = colorAnalysis.matchPHWorkbookSamples(grouped.samples[0], references);
  assert.equal(groupedResult.accepted, true);
  assert.equal(groupedResult.value, null);
  assert.equal(groupedResult.displayValue, '9-14');
  assert.equal(groupedResult.groupedReference, true);
  assert.equal(references.find((reference) => reference.label === '9-14').value, null);
});

test('the grouped workbook reference does not bypass the existing low-saturation quality guard', () => {
  const grouped = calibration.pH.workbookCalibration.references.find((reference) => reference.label === '9-14');
  const referenceMatch = colorAnalysis.matchPHWorkbookSamples(grouped.samples[0], calibration.pH.workbookCalibration.references);
  const quality = colorAnalysis.assessColorQuality(grouped.samples[0]);

  assert.equal(referenceMatch.accepted, true);
  assert.equal(referenceMatch.value, null);
  assert.equal(referenceMatch.displayValue, '9-14');
  assert.equal(quality.reliable, false);
  assert.ok(quality.reasons.includes('LOW_SATURATION'));
});

test('overlapping workbook references reject the value and block the old continuous pH fallback', () => {
  const references = [
    {
      label: '2', value: 2, enabled: true, maximumDeltaE00: 2, minimumMargin: 0.5,
      samples: [[100, 100, 100]],
    },
    {
      label: '3', value: 3, enabled: true, maximumDeltaE00: 2, minimumMargin: 0.5,
      samples: [[100, 100, 100]],
    },
  ];

  const result = colorAnalysis.matchPHWorkbookSamples([100, 100, 100], references);
  assert.equal(result.accepted, false);
  assert.equal(result.matchState, 'AMBIGUOUS_REFERENCE_MATCH');
  assert.equal(result.blocksFallback, true);
});

test('colors outside the workbook capture envelope do not block the existing pH model', () => {
  const references = [
    {
      label: '1', value: 1, enabled: true, maximumDeltaE00: 1, minimumMargin: 1,
      samples: [[100, 100, 100]],
    },
  ];

  const result = colorAnalysis.matchPHWorkbookSamples([240, 240, 240], references);
  assert.equal(result.accepted, false);
  assert.equal(result.blocksFallback, false);
});

test('a portrait client color outside every workbook class RGB envelope remains unmatched', () => {
  const result = colorAnalysis.matchPHWorkbookSamples(
    [135, 148, 123],
    calibration.pH.workbookCalibration.references,
  );

  assert.equal(result.accepted, false);
  assert.equal(result.diagnostics.bestReference.label, '8');
  assert.equal(result.diagnostics.withinClassRGBEnvelope, false);
  assert.equal(result.blocksFallback, false);
});

test('workbook Nitrite RGB observations remain unlabeled and cannot create ppm references', () => {
  assert.equal(workbook.nitrite.label, null);
  assert.equal(workbook.nitrite.ppm, null);
  assert.equal(workbook.nitrite.samples.length, 10);
  assert.equal(workbook.nitrite.calibrationUse, 'PROVENANCE_ONLY_NO_PPM_LABELS');
  assert.deepEqual(calibration.nitrite.references.map(({ value }) => value), [0, 0.5, 1, null]);
});

test('workbook confidence cutoffs record the conservative within-workbook holdout evidence', () => {
  const validation = calibration.pH.workbookCalibration.validation;
  assert.equal(validation.method, 'per-sample leave-one-out nearest-reference with RGB envelope, Delta E 2000 distance, and class-specific margin gates');
  const references = calibration.pH.workbookCalibration.references;
  const measurements = references.flatMap((reference) => reference.samples.map((rgb, sampleIndex) => ({
    label: reference.label,
    rgb,
    sampleIndex,
  })));
  const outcomes = measurements.map((measurement) => {
    const candidates = references.map((reference) => {
      const samples = reference.samples.filter((_, index) => (
        reference.label !== measurement.label || index !== measurement.sampleIndex
      ));
      const channelRanges = [0, 1, 2].map((channel) => [
        Math.floor(Math.min(...samples.map((sample) => sample[channel]))),
        Math.ceil(Math.max(...samples.map((sample) => sample[channel]))),
      ]);
      const distance = Math.min(...samples.map((sample) => colorAnalysis.deltaE00(
        colorAnalysis.rgbToLab(measurement.rgb),
        colorAnalysis.rgbToLab(sample),
      )));
      const withinRgbEnvelope = measurement.rgb.every((value, channel) => (
        value >= channelRanges[channel][0] && value <= channelRanges[channel][1]
      ));
      return { reference, distance, withinRgbEnvelope };
    }).sort((left, right) => left.distance - right.distance);
    const best = candidates[0];
    const margin = candidates[1].distance - best.distance;
    const accepted = best.withinRgbEnvelope
      && best.distance <= best.reference.maximumDeltaE00
      && margin >= best.reference.minimumMargin;
    return {
      correct: best.reference.label === measurement.label,
      accepted,
    };
  });
  const nearestCorrectCount = outcomes.filter(({ correct }) => correct).length;
  const accepted = outcomes.filter(({ accepted: isAccepted }) => isAccepted);
  const acceptedCorrectCount = accepted.filter(({ correct }) => correct).length;
  const acceptedIncorrectCount = accepted.filter(({ correct }) => !correct).length;

  assert.equal(validation.sampleCount, outcomes.length);
  assert.equal(validation.nearestLabelCorrectCount, nearestCorrectCount);
  assert.equal(validation.acceptedCorrectCount, acceptedCorrectCount);
  assert.equal(validation.acceptedIncorrectCount, acceptedIncorrectCount);
  assert.equal(outcomes.length, 74);
  assert.equal(nearestCorrectCount, 65);
  assert.equal(acceptedCorrectCount, 40);
  assert.equal(acceptedIncorrectCount, 0);
  assert.equal(validation.independentValidation, false);
});

test('analysis engine uses workbook pH only when the existing models do not accept the ROI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-workbook-ph-'));
  const imagePath = join(directory, 'workbook-ph1.png');
  const rgb = [178, 119, 129];
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) pixels.set(rgb, offset);
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const fixtureCalibration = JSON.parse(await readFile(
      new URL('../database/colorAnalysisCalibration.json', import.meta.url),
      'utf8',
    ));
    const { huePoints, ppmValues, ...nitriteWithoutDeveloperInterpolation } = fixtureCalibration.nitrite;
    const result = await createColorAnalysisEngine({
      readJson: async () => ({
        ...fixtureCalibration,
        nitrite: nitriteWithoutDeveloperInterpolation,
      }),
    }).analyze({ imagePath });
    assert.deepEqual(result.pH.measuredRGB, rgb);
    assert.equal(result.pH.value, 1);
    assert.equal(result.pH.displayValue, '1');
    assert.equal(result.pH.exactValue, 1);
    assert.equal(result.pH.matchMethod, 'WORKBOOK_CIEDE2000_NEAREST_SAMPLE');
    assert.equal(result.pH.matchedReference.label, '1');
    assert.equal(result.pH.reliabilityStatus, 'CLIENT_WORKBOOK_RGB_REFERENCE_MATCH');
    assert.equal(result.nitrite.value, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('official-time continuous pH remains first when the same color is also a workbook reference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-workbook-priority-'));
  const imagePath = join(directory, 'official-time-color.png');
  const rgb = [141, 152, 115];
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) pixels.set(rgb, offset);
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const overlapCalibration = {
      ...calibration,
      pH: {
        ...calibration.pH,
        workbookCalibration: {
          ...calibration.pH.workbookCalibration,
          references: [
            { label: '1', value: 1, enabled: true, maximumDeltaE00: 1, minimumMargin: 0.1, samples: [rgb] },
            { label: '2', value: 2, enabled: true, maximumDeltaE00: 1, minimumMargin: 0.1, samples: [[100, 100, 100]] },
          ],
        },
      },
    };
    const result = await createColorAnalysisEngine({ readJson: async () => overlapCalibration }).analyze({ imagePath });

    assert.equal(result.pH.matchMethod, 'official-time-continuous-lab-ridge-quadratic');
    assert.ok(Math.abs(result.pH.value - 7.9955) < 0.001);
    assert.equal(result.pH.exactValue, null);
    assert.equal(result.pH.displayValue, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
