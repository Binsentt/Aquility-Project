import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

const calibrationPath = new URL('../database/colorAnalysisCalibration.json', import.meta.url);
const fixturePath = new URL('./fixtures/real-client-930-aw-1min.jpg', import.meta.url);
const fixtureFile = fileURLToPath(fixturePath);

async function loadCalibrationQaModule() {
  try {
    return await import('../services/calibrationQaReport.js');
  } catch (error) {
    assert.fail(`Calibration QA report module is unavailable: ${error.message}`);
  }
}

test('calibration QA report uses the production analysis engine and reports its measured ROIs', async () => {
  const { generateCalibrationQaReport } = await loadCalibrationQaModule();
  const imagePath = fixtureFile;
  const engine = createColorAnalysisEngine();
  const production = await engine.analyze({ imagePath });
  const [row] = await generateCalibrationQaReport([imagePath], { engine });

  assert.equal(row.image, basename(imagePath));
  assert.equal(row.registrationStatus, production.registration.status);
  assert.deepEqual(row.pHRgb, production.pH.measuredRGB);
  assert.deepEqual(row.nitriteRgb, production.nitrite.measuredRGB);
  assert.equal(row.pHAccepted, production.pH.value == null ? 'UNAVAILABLE' : 'ACCEPTED');
  assert.equal(row.nitriteAccepted, production.nitrite.quantitativeAvailable ? 'ACCEPTED' : 'UNAVAILABLE');
  assert.ok(row.pHNearestReference?.label);
  assert.ok(Number.isFinite(row.pHDistance?.value));
  assert.ok(row.pHDistance?.metric);
  assert.equal(row.nitriteNearestReference.label, production.nitrite.closestReference.label);
  assert.equal(row.nitriteDistance.value, production.nitrite.distance);
  assert.equal(row.nitriteDistance.diagnosticOnly, true);
  assert.equal(Object.hasOwn(row, 'thresholds'), false);
});

test('calibration QA does not modify production calibration or read the candidate CSV', async () => {
  const { generateCalibrationQaReport } = await loadCalibrationQaModule();
  const calibrationBefore = await readFile(calibrationPath, 'utf8');
  const calibration = JSON.parse(calibrationBefore);
  const calibrationReads = [];
  const engine = createColorAnalysisEngine({
    readJson: async (filename) => {
      calibrationReads.push(filename);
      return JSON.parse(calibrationBefore);
    },
  });

  await generateCalibrationQaReport([fixtureFile], { engine, calibration });

  assert.deepEqual(calibrationReads, ['colorAnalysisCalibration.json']);
  assert.equal(await readFile(calibrationPath, 'utf8'), calibrationBefore);
  assert.equal(calibration.thresholds, null);
});

test('candidate calibration CSV is header-only and approval metadata is not activated', async () => {
  const csvPath = new URL('../database/calibration-candidates.template.csv', import.meta.url);
  let csv;
  try {
    csv = await readFile(csvPath, 'utf8');
  } catch (error) {
    assert.fail(`Header-only candidate calibration CSV is unavailable: ${error.message}`);
  }
  const rows = csv.trim().split(/\r?\n/);

  assert.equal(rows.length, 1);
  assert.equal(rows[0], 'sample_id,parameter,reference_value,reference_unit,reference_source,image_file,measured_r,measured_g,measured_b,capture_condition,capture_date,notes,approved');
  assert.equal(JSON.parse(await readFile(calibrationPath, 'utf8')).thresholds, null);
});

test('unmatched real-image readings remain unavailable and no values are invented', async () => {
  const { generateCalibrationQaReport } = await loadCalibrationQaModule();
  const [row] = await generateCalibrationQaReport([fixtureFile]);

  assert.equal(row.pHAccepted, 'UNAVAILABLE');
  assert.equal(row.nitriteAccepted, 'UNAVAILABLE');
  assert.equal(Object.hasOwn(row, 'pHValue'), false);
  assert.equal(Object.hasOwn(row, 'nitriteValue'), false);
  assert.equal(JSON.parse(await readFile(calibrationPath, 'utf8')).thresholds, null);
});

test('unregistered images produce an unavailable report row without numeric outputs', async () => {
  const { generateCalibrationQaReport } = await loadCalibrationQaModule();
  const directory = await mkdtemp(join(tmpdir(), 'aquality-calibration-qa-'));
  const imagePath = join(directory, 'unregistered.jpg');
  try {
    await sharp({
      create: { width: 160, height: 120, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toFile(imagePath);
    const [row] = await generateCalibrationQaReport([imagePath]);

    assert.equal(row.registrationStatus, 'STRIP_REGISTRATION_FAILED');
    assert.equal(row.pHRgb, null);
    assert.equal(row.nitriteRgb, null);
    assert.equal(row.pHAccepted, 'UNAVAILABLE');
    assert.equal(row.nitriteAccepted, 'UNAVAILABLE');
    assert.equal(Object.hasOwn(row, 'pHValue'), false);
    assert.equal(Object.hasOwn(row, 'nitriteValue'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('QA does not infer registration or accept results when the production response omits registration status', async () => {
  const { generateCalibrationQaReport } = await loadCalibrationQaModule();
  const calibration = JSON.parse(await readFile(calibrationPath, 'utf8'));
  const [row] = await generateCalibrationQaReport(['opaque.jpg'], {
    calibration,
    engine: {
      async analyze() {
        return {
          pH: { value: 7, measuredRGB: [58, 58, 58], measuredLab: [24, 0, 0], deltaE00: 0 },
          nitrite: { value: 0.5, quantitativeAvailable: true, measuredRGB: [190, 172, 187], distance: 0.5 },
        };
      },
    },
  });

  assert.equal(row.registrationStatus, 'REGISTRATION_STATUS_UNAVAILABLE');
  assert.equal(row.pHAccepted, 'UNAVAILABLE');
  assert.equal(row.nitriteAccepted, 'UNAVAILABLE');
});

test('backend README describes body contour and millimeter dimensions as non-gating metadata', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /body contour is diagnostic only/i);
  assert.match(readme, /physical (?:mm )?dimensions[^.]*not (?:scan )?acceptance gates/i);
  assert.match(readme, /no production center-crop fallback/i);
  assert.doesNotMatch(readme, /If the body, fiducials, or either circular zone cannot be detected/i);
});
