import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  deltaE00,
  extractRoiStatistics,
  interpolateNitriteHue,
  matchPHReference,
  rgbToHsv,
  rgbToLab,
} from '../utils/colorAnalysis.js';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

const huePoints = [15, 30, 50, 90];
const ppmValues = [0, 10, 25, 100];

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

test('Nitrite calibration points map to the supplied ppm values', () => {
  for (const [index, hue] of huePoints.entries()) {
    assert.equal(interpolateNitriteHue(hue, huePoints, ppmValues).ppm, ppmValues[index]);
  }
});

test('Nitrite piecewise interpolation returns intermediate values and clamps endpoints', () => {
  assert.equal(interpolateNitriteHue(22.5, huePoints, ppmValues).ppm, 5);
  assert.equal(interpolateNitriteHue(40, huePoints, ppmValues).ppm, 17.5);
  assert.equal(interpolateNitriteHue(70, huePoints, ppmValues).ppm, 62.5);
  assert.equal(interpolateNitriteHue(0, huePoints, ppmValues).ppm, 0);
  assert.equal(interpolateNitriteHue(0, huePoints, ppmValues).clamped, true);
  assert.equal(interpolateNitriteHue(120, huePoints, ppmValues).ppm, 100);
  assert.equal(interpolateNitriteHue(120, huePoints, ppmValues).clamped, true);
});

test('analysis decodes an image, samples its ROI, and returns pH plus Nitrite metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-color-analysis-'));
  const imagePath = join(directory, 'sample.png');
  const pixels = Buffer.alloc(20 * 20 * 3);
  for (let index = 0; index < 400; index += 1) pixels.set([255, 128, 64], index * 3);
  await sharp(pixels, { raw: { width: 20, height: 20, channels: 3 } }).png().toFile(imagePath);

  try {
    const result = await createColorAnalysisEngine().analyze({ imagePath });
    assert.deepEqual(result.pH.measuredRGB, [255, 128, 64]);
    assert.equal(result.pH.unit, 'pH');
    assert.ok(result.pH.measuredLab.length === 3);
    assert.ok(result.pH.deltaE00 >= 0);
    assert.deepEqual(result.nitrite.measuredRGB, [255, 128, 64]);
    assert.ok(Math.abs(result.nitrite.hue - rgbToHsv(result.nitrite.measuredRGB).hue) < 0.001);
    assert.equal(result.nitrite.value, interpolateNitriteHue(result.nitrite.hue, huePoints, ppmValues).ppm);
    assert.equal(result.nitrite.unit, 'ppm');
    assert.equal(result.nitrite.interpolationMethod, 'piecewise-linear-clamped');
    assert.equal(result.overallStatus, 'Unvalidated');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('analysis decodes every image format accepted by the upload middleware', async () => {
  sharp.cache({ files: 0 });
  const directory = await mkdtemp(join(tmpdir(), 'aquility-image-formats-'));
  const pixels = Buffer.alloc(20 * 20 * 3, 128);
  const engine = createColorAnalysisEngine();

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

test('analysis returns a safe invalid-image error when Sharp cannot decode the upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-invalid-image-'));
  const imagePath = join(directory, 'corrupt.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));

  try {
    await assert.rejects(
      () => createColorAnalysisEngine().analyze({ imagePath }),
      { code: 'INVALID_IMAGE', status: 400, message: 'The uploaded image could not be decoded. Please select a valid JPEG, PNG, or WebP image.' }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});