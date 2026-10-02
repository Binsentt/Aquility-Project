import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

const nonProportionalTemplateSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200">
  <rect width="500" height="200" fill="#eeeeee"/>
  <rect x="10" y="25" width="480" height="150" rx="12" fill="#111111"/>
  <rect x="48" y="93" width="14" height="14" fill="#ffffff"/>
  <circle cx="106" cy="100" r="18" fill="#e79b8a"/>
  <circle cx="202" cy="100" r="18" fill="#79a8dc"/>
  <polygon points="260,90 260,110 280,100" fill="#ffffff"/>
</svg>`;

const relaxedSpacingTemplateSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="140">
  <rect width="500" height="140" fill="#eeeeee"/>
  <rect x="10" y="45" width="480" height="50" rx="12" fill="#111111"/>
  <rect x="42" y="63" width="14" height="14" fill="#ffffff"/>
  <circle cx="150" cy="70" r="18" fill="#e79b8a"/>
  <circle cx="290" cy="70" r="18" fill="#79a8dc"/>
  <polygon points="430,60 430,80 450,70" fill="#ffffff"/>
</svg>`;

async function rawSvg(svg, transform = null) {
  let image = sharp(Buffer.from(svg));
  if (transform === 'rotate180') image = image.rotate(180);
  if (transform === 'rotate90') image = image.rotate(90);
  if (transform === 'rotate270') image = image.rotate(270);
  if (transform === 'resize50') image = image.resize(250, 50);
  if (transform === 'resize75') image = image.resize(375, 75);
  if (transform === 'resize150') image = image.resize(750, 150);
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

test('real Android strip photo registers despite softened fiducial contours', async () => {
  const image = await readFile(new URL('./fixtures/real-android-upad.jpg', import.meta.url));
  const { data, info } = await sharp(image).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.ok(result.square.center.x < result.nitrite.center.x);
  assert.ok(result.nitrite.center.x < result.pH.center.x);
  assert.ok(result.pH.center.x < result.triangle.center.x);
  assert.ok(result.square.center.x > 350 && result.square.center.x < 470);
  assert.ok(result.triangle.center.x > 550 && result.triangle.center.x < 680);
  assert.ok(result.nitrite.center.x > 420 && result.nitrite.center.x < 500);
  assert.ok(result.pH.center.x > 510 && result.pH.center.x < 580);
  assert.ok(result.candidates.square >= 1);
  assert.ok(result.candidates.triangle >= 1);
  assert.equal(result.geometry.referenceScale, 'square-to-triangle-pixel-distance');
  assert.ok(result.geometry.pairConfidence > 0);
  assert.equal(result.geometry.physicalPriorScore, null);
  assert.equal(result.diagnostics.physicalPriorScore, null);
});

test('registration preserves zone assignment through rotation and scale changes', async () => {
  for (const transform of ['rotate180', 'rotate90', 'rotate270', 'resize50', 'resize75', 'resize150']) {
    const { data, info } = await rawSvg(templateSvg(), transform);
    const result = detectUPadRegistration(data, info.width, info.height);

    assert.equal(result.status, 'REGISTERED', transform);
    assert.ok(result.nitrite.normalized.x < result.pH.normalized.x, transform);
    assert.ok(Math.abs(result.nitrite.normalized.x - UPAD_TEMPLATE.normalized.nitrite.x) < 0.12, transform);
    assert.ok(Math.abs(result.pH.normalized.x - UPAD_TEMPLATE.normalized.pH.x) < 0.12, transform);
  }
});

test('registration does not require the documented body proportions', async () => {
  const { data, info } = await rawSvg(nonProportionalTemplateSvg());
  const result = detectUPadRegistration(data, info.width, info.height);

  assert.equal(result.status, 'REGISTERED');
  assert.equal(result.nitrite.zone, 'nitrite');
  assert.equal(result.pH.zone, 'pH');
  assert.notDeepEqual(result.nitrite.roi, result.pH.roi);
});

test('registration accepts fiducials whose spacing differs from the physical schematic', async () => {
  const { data, info } = await rawSvg(relaxedSpacingTemplateSvg());
  const result = detectUPadRegistration(data, info.width, info.height);

  assert.equal(result.status, 'REGISTERED');
  assert.ok(result.square.center.x < result.nitrite.center.x);
  assert.ok(result.nitrite.center.x < result.pH.center.x);
  assert.ok(result.pH.center.x < result.triangle.center.x);
});

test('strong fiducials derive registered zones when wet-zone contours are too soft', async () => {
  const svg = templateSvg({ extra: '<circle cx="106" cy="50" r="18" fill="#777777"/><circle cx="202" cy="50" r="18" fill="#777777"/>' });
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.ok(['template-derived-zone', 'detected-contour'].includes(result.nitrite.source));
  assert.ok(['template-derived-zone', 'detected-contour'].includes(result.pH.source));
  assert.equal(result.diagnostics.finalRejectionReason, null);
  assert.equal(result.diagnostics.zoneEvidence.nitrite.accepted, true);
  assert.equal(result.diagnostics.zoneEvidence.pH.accepted, true);
});

test('strong fiducials can establish the frame when the dark body contour is unavailable', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
    <rect width="500" height="100" fill="#777777"/>
    <rect x="48" y="43" width="14" height="14" fill="#ffffff"/>
    <circle cx="106" cy="50" r="18" fill="#aaaaaa"/>
    <circle cx="202" cy="50" r="18" fill="#aaaaaa"/>
    <polygon points="260,40 260,60 280,50" fill="#ffffff"/>
  </svg>`;
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.equal(result.body.source, 'anchor-derived');
  assert.equal(result.diagnostics.bodyEstimate.confidence, 0.45);
});

test('fiducial search ignores a misleading dark body candidate elsewhere in the frame', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="180">
    <rect width="700" height="180" fill="#eeeeee"/>
    <rect x="10" y="10" width="420" height="80" rx="8" fill="#111111"/>
    <rect x="150" y="65" width="500" height="50" rx="12" fill="#111111"/>
    <rect x="188" y="83" width="14" height="14" fill="#ffffff"/>
    <circle cx="256" cy="90" r="18" fill="#e79b8a"/>
    <circle cx="356" cy="90" r="18" fill="#79a8dc"/>
    <polygon points="510,80 510,100 530,90" fill="#ffffff"/>
  </svg>`;
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.equal(result.diagnostics.fullFrameSearch, true);
  assert.equal(result.diagnostics.bodySearchRegionUsed, false);
  assert.ok(result.square.center.x > 150);
  assert.ok(result.triangle.center.x > result.pH.center.x);
});

test('dark fiducials on a light strip are detected without a bright-only assumption', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
    <rect width="500" height="100" fill="#eeeeee"/>
    <rect x="10" y="25" width="480" height="50" rx="12" fill="#dddddd"/>
    <rect x="48" y="43" width="14" height="14" fill="#222222"/>
    <circle cx="106" cy="50" r="18" fill="#777777"/>
    <circle cx="202" cy="50" r="18" fill="#666666"/>
    <polygon points="260,40 260,60 280,50" fill="#222222"/>
  </svg>`;
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.ok(result.diagnostics.darkFeatureCandidateCount > 0);
  assert.ok(result.square.center.x < result.nitrite.center.x);
  assert.ok(result.nitrite.center.x < result.pH.center.x);
  assert.ok(result.pH.center.x < result.triangle.center.x);
});

test('registration failures expose safe, request-correlated diagnostic fields', async () => {
  const { data, info } = await rawSvg('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100"><rect width="500" height="100" fill="#eeeeee"/></svg>');
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.notEqual(result.status, 'REGISTERED');
  assert.equal(result.diagnostics.imageWidth, 500);
  assert.equal(result.diagnostics.imageHeight, 100);
  assert.equal(result.diagnostics.orientationNormalized, true);
  assert.equal(result.diagnostics.finalRejectionReason, 'SQUARE_NOT_FOUND');
  assert.equal(result.diagnostics.selectedSquare, null);
  assert.equal(result.diagnostics.selectedTriangle, null);
  assert.match(buildUPadDiagnosticOverlaySvg(result), /rejection: SQUARE_NOT_FOUND/);
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
