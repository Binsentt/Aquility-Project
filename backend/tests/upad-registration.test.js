import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildUPadDiagnosticOverlaySvg, detectUPadRegistration, UPAD_TEMPLATE } from '../services/upadRegistration.js';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

const templateSvg = ({ background = '#eeeeee', extra = '' } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
  <rect width="500" height="100" fill="${background}"/>
  <rect x="10" y="25" width="480" height="50" rx="12" fill="#111111"/>
  <rect x="48" y="43" width="14" height="14" fill="#ffffff"/>
  <circle cx="106" cy="50" r="18" fill="#e79b8a"/>
  <circle cx="202" cy="50" r="18" fill="#79a8dc"/>
  <polygon points="260,40 260,60 280,50" fill="#ffffff"/>
  ${extra}
</svg>`;

async function rawSvg(svg, transform = null) {
  let image = sharp(Buffer.from(svg));
  if (transform === 'rotate180') image = image.rotate(180);
  if (transform === 'rotate90') image = image.rotate(90);
  if (transform === 'rotate270') image = image.rotate(270);
  if (transform === 'resize') image = image.resize(900, 180);
  return image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

test('client schematic registration detects square, triangle, and separate ordered zones', async () => {
  const { data, info } = await rawSvg(templateSvg());
  const result = detectUPadRegistration(data, info.width, info.height);

  assert.equal(result.status, 'REGISTERED');
  assert.equal(result.template.source, UPAD_TEMPLATE.source);
  assert.deepEqual(result.template.physicalMeasurements, {
    squareSideMm: 2.5,
    triangleSideMm: 2.5,
    outerReferenceSpacingMm: 2.625,
    circleSpacingMm: 5,
    spacingInterpretation: 'ambiguous-edge-versus-center',
    provenance: 'CLIENT_PHYSICAL_MEASUREMENT',
  });
  assert.equal(result.template.schematicCoordinateProvenance, 'CLIENT_SCHEMATIC_DERIVED');
  assert.ok(result.registrationConfidence > 0.5);
  assert.ok(result.square.center.x < result.nitrite.center.x);
  assert.ok(result.nitrite.center.x < result.pH.center.x);
  assert.ok(result.pH.center.x < result.triangle.center.x);
  assert.notDeepEqual(result.nitrite.roi, result.pH.roi);
  assert.equal(result.nitrite.zone, 'nitrite');
  assert.equal(result.pH.zone, 'pH');
  const overlaySvg = buildUPadDiagnosticOverlaySvg(result);
  assert.match(overlaySvg, /REFERENCE POINT 1/);
  assert.match(overlaySvg, /NITRITE ZONE/);
  assert.match(overlaySvg, /pH ZONE/);
});

test('registration preserves zone assignment through rotation and scale changes', async () => {
  for (const transform of ['rotate180', 'rotate90', 'rotate270', 'resize']) {
    const { data, info } = await rawSvg(templateSvg(), transform);
    const result = detectUPadRegistration(data, info.width, info.height);

    assert.equal(result.status, 'REGISTERED', transform);
    assert.ok(result.nitrite.normalized.x < result.pH.normalized.x, transform);
    assert.ok(Math.abs(result.nitrite.normalized.x - UPAD_TEMPLATE.normalized.nitrite.x) < 0.12, transform);
    assert.ok(Math.abs(result.pH.normalized.x - UPAD_TEMPLATE.normalized.pH.x) < 0.12, transform);
  }
});

test('random objects and incomplete reference pairs are rejected before analysis', async () => {
  const fixtures = [
    '<rect width="500" height="100" fill="#dddddd"/>',
    '<rect width="500" height="100" fill="#333333"/>',
    '<rect width="500" height="100" fill="#222222"/><circle cx="250" cy="50" r="20" fill="#ff00aa"/>',
    '<rect width="500" height="100" fill="#eeeeee"/><polygon points="50,20 20,80 80,80" fill="#111111"/>',
    '<rect width="500" height="100" fill="#eeeeee"/><rect x="35" y="35" width="30" height="30" fill="#111111"/>',
    '<rect width="500" height="100" fill="#eeeeee"/><rect x="10" y="25" width="480" height="50" fill="#111111"/><rect x="100" y="40" width="12" height="12" fill="#fff"/><polygon points="350,40 350,60 370,50" fill="#fff"/>',
  ];

  for (const fixture of fixtures) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">${fixture}</svg>`;
    const { data, info } = await rawSvg(svg);
    const result = detectUPadRegistration(data, info.width, info.height);
    assert.notEqual(result.status, 'REGISTERED', fixture);
  }
});

test('analysis uses registered circle ROIs and remains fail-closed without a pH threshold', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-upad-engine-'));
  const imagePath = join(directory, 'registered.png');
  const { data, info } = await rawSvg(templateSvg());
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(imagePath);
  const diagnostics = [];

  try {
    await assert.rejects(
      () => createColorAnalysisEngine().analyze({
        imagePath,
        debugLogger: (stage, details) => diagnostics.push({ stage, details }),
      }),
      { code: 'PH_MEASUREMENT_UNRELIABLE', status: 422 },
    );
    const registration = diagnostics.find(({ stage }) => stage === 'upad-registration');
    assert.equal(registration.details.status, 'REGISTERED');
    assert.ok(registration.details.overlay.labels.some(({ label }) => label === 'NITRITE ZONE'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
