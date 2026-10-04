import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildUPadDiagnosticOverlaySvg, detectUPadRegistration, UPAD_TEMPLATE } from '../services/upadRegistration.js';
import { createColorAnalysisEngine } from '../services/colorAnalysisEngine.js';

const toHexColor = (rgb) => `#${rgb.map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`;

const templateSvg = ({ background = '#eeeeee', extra = '', nitriteColor = '#e79b8a', pHColor = '#79a8dc' } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
  <rect width="500" height="100" fill="${background}"/>
  <rect x="10" y="25" width="480" height="50" rx="12" fill="#111111"/>
  <rect x="48" y="43" width="14" height="14" fill="#ffffff"/>
  <circle cx="106" cy="50" r="18" fill="${nitriteColor}"/>
  <circle cx="202" cy="50" r="18" fill="${pHColor}"/>
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

function assertDetectedInnerSensingGeometry(result, width, height) {
  assert.equal(result.status, 'REGISTERED');
  const squareToTriangle = (point) => Math.hypot(point.x - result.triangle.center.x, point.y - result.triangle.center.y);
  for (const zone of [result.nitrite, result.pH]) {
    assert.equal(zone.source, 'detected-contour');
    assert.equal(zone.roi.shape, 'ellipse');
    assert.equal(zone.roi.sampleRadiusFraction, 0.68);
    assert.ok(zone.roi.radiusX * width < zone.bounds.width / 2);
    assert.ok(zone.roi.radiusY * height < zone.bounds.height / 2);
    assert.equal(zone.roi.center.x, zone.center.x / width);
    assert.equal(zone.roi.center.y, zone.center.y / height);
  }
  assert.ok(Math.hypot(result.nitrite.center.x - result.square.center.x, result.nitrite.center.y - result.square.center.y)
    < squareToTriangle(result.nitrite.center), 'Nitrite circle is closer to the square fiducial');
  assert.ok(squareToTriangle(result.pH.center)
    < Math.hypot(result.pH.center.x - result.square.center.x, result.pH.center.y - result.square.center.y),
  'pH circle is closer to the triangle fiducial');
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
  assert.match(overlaySvg, /data-sample="NITRITE"/);
  assert.match(overlaySvg, /data-sample="pH"/);
  for (const zone of [result.nitrite, result.pH]) {
    assert.equal(zone.roi.shape, 'ellipse');
    assert.equal(zone.roi.center.x, zone.center.x / info.width);
    assert.equal(zone.roi.center.y, zone.center.y / info.height);
    assert.ok(zone.roi.radiusX * info.width < zone.bounds.width / 2);
    assert.ok(zone.roi.radiusY * info.height < zone.bounds.height / 2);
  }
  assertDetectedInnerSensingGeometry(result, info.width, info.height);
  assert.ok(Math.hypot(result.nitrite.center.x - result.square.center.x, result.nitrite.center.y - result.square.center.y)
    < Math.hypot(result.nitrite.center.x - result.triangle.center.x, result.nitrite.center.y - result.triangle.center.y));
  assert.ok(Math.hypot(result.pH.center.x - result.triangle.center.x, result.pH.center.y - result.triangle.center.y)
    < Math.hypot(result.pH.center.x - result.square.center.x, result.pH.center.y - result.square.center.y));
});

test('registered production pipeline returns individual pH and Nitrite levels from their own sensing circles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-registered-calibration-'));
  const cases = [
    { pH: 1, pHRgb: [168, 133, 122], nitriteRgb: [183, 172, 180], nitriteExpected: '0 ppm' },
    { pH: 2, pHRgb: [173, 138, 133], nitriteRgb: [190, 172, 187], nitriteExpected: '0.5 ppm' },
    { pH: 3, pHRgb: [169, 130, 115], nitriteRgb: [202, 183, 183], nitriteExpected: '1 ppm' },
    { pH: 4, pHRgb: [166, 125, 125], nitriteRgb: [197, 179, 195], nitriteExpected: '>1 ppm' },
  ];

  try {
    const engine = createColorAnalysisEngine();
    for (const sample of cases) {
      const imagePath = join(directory, `registered-pH-${sample.pH}.png`);
      await sharp(Buffer.from(templateSvg({
        nitriteColor: toHexColor(sample.nitriteRgb),
        pHColor: toHexColor(sample.pHRgb),
      }))).png().toFile(imagePath);
      const result = await engine.analyze({ imagePath });

      assert.equal(result.registration.status, 'REGISTERED');
      assert.equal(result.pH.roi.zone, 'pH');
      assert.equal(result.nitrite.roi.zone, 'nitrite');
      assert.deepEqual(result.pH.measuredRGB, sample.pHRgb);
      assert.deepEqual(result.nitrite.measuredRGB, sample.nitriteRgb);
      assert.equal(result.pH.value, sample.pH);
      assert.equal(result.nitrite.displayValue, sample.nitriteExpected);
      assert.equal(result.measuredParametersStatus, 'Not classified');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('registered production matcher accepts nearby configured colors using calibrated distance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-registered-distance-match-'));
  const imagePath = join(directory, 'registered-near-reference.png');
  await sharp(Buffer.from(templateSvg({
    nitriteColor: toHexColor([191, 172, 188]),
    pHColor: toHexColor([168, 133, 121]),
  }))).png().toFile(imagePath);

  try {
    const diagnostics = [];
    const result = await createColorAnalysisEngine().analyze({
      imagePath,
      debugLogger: (stage, details) => diagnostics.push({ stage, details }),
    });
    const matchDiagnostics = diagnostics.find(({ stage }) => stage === 'parameter-match-diagnostics');

    assert.equal(result.registration.status, 'REGISTERED');
    assert.equal(result.pH.roi.zone, 'pH');
    assert.equal(result.nitrite.roi.zone, 'nitrite');
    assert.deepEqual(result.pH.measuredRGB, [168, 133, 121]);
    assert.deepEqual(result.nitrite.measuredRGB, [191, 172, 188]);
    assert.equal(result.pH.value, 1);
    assert.equal(result.nitrite.value, 0.5);
    assert.equal(result.nitrite.displayValue, '0.5 ppm');
    assert.equal(result.measuredParametersStatus, 'Not classified');
    assert.equal(matchDiagnostics.details.pH.accepted, true);
    assert.equal(matchDiagnostics.details.nitrite.accepted, true);
    assert.equal(matchDiagnostics.details.pH.bestReference.value, 1);
    assert.equal(matchDiagnostics.details.nitrite.bestReference.value, 0.5);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fiducials on a plain background do not register nonexistent sensing circles', async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
    <rect width="500" height="100" fill="#aaaaaa"/>
    <rect x="48" y="43" width="14" height="14" fill="#ffffff"/>
    <polygon points="260,40 260,60 280,50" fill="#ffffff"/>
  </svg>`;
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.notEqual(result.status, 'REGISTERED');
  assert.equal(result.failureCode, 'NITRITE_ROI_INVALID');
  assert.equal(result.diagnostics.nitriteROI.localized, false);
  assert.equal(result.diagnostics.phROI.localized, false);

  const directory = await mkdtemp(join(tmpdir(), 'aquility-no-zones-'));
  const imagePath = join(directory, 'fiducials-only.png');
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  try {
    await assert.rejects(
      createColorAnalysisEngine().analyze({ imagePath }),
      (error) => error.status === 422 && error.code === 'STRIP_REGISTRATION_FAILED',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('real Android strip photo registers despite softened fiducial contours', async () => {
  const image = await readFile(new URL('./fixtures/real-android-upad.jpg', import.meta.url));
  const { data, info } = await sharp(image).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assertDetectedInnerSensingGeometry(result, info.width, info.height);
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

test('high-resolution client µPAD photo registers at its original phone resolution', async () => {
  const image = await readFile(new URL('./fixtures/real-client-930-aw-1min.jpg', import.meta.url));
  const { data, info } = await sharp(image).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(info.width, 3048);
  assert.equal(info.height, 4064);
  assert.equal(result.status, 'REGISTERED');
  assertDetectedInnerSensingGeometry(result, info.width, info.height);
  assert.ok(result.candidates.square >= 1);
  assert.ok(result.candidates.triangle >= 1);
  assert.ok(result.nitrite.roi);
  assert.ok(result.pH.roi);
  assert.notDeepEqual(result.nitrite.roi, result.pH.roi);
});

test('portrait client µPAD assigns sensing circles from the true square-to-triangle order', async () => {
  const image = await readFile(new URL('./fixtures/real-client-930-aw-ph2.jpg', import.meta.url));
  const normalized = await sharp(image).rotate().toBuffer();

  for (const rotation of [0, 180]) {
    const { data, info } = await sharp(normalized).rotate(rotation).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

    assert.equal(result.status, 'REGISTERED', `rotation ${rotation}`);
    assertDetectedInnerSensingGeometry(result, info.width, info.height);
    if (rotation === 0) {
      assert.ok(result.square.center.y > result.triangle.center.y, 'square is the lower physical fiducial');
      assert.ok(result.nitrite.center.y > result.pH.center.y, 'Nitrite is nearer the square and pH is nearer the triangle');
    } else {
      assert.ok(result.square.center.y < result.triangle.center.y, 'square remains the physical square after rotation');
      assert.ok(result.nitrite.center.y < result.pH.center.y, 'Nitrite remains nearer the square after rotation');
    }
    assert.ok(result.nitrite.roi && result.pH.roi);
    assert.notDeepEqual(result.nitrite.roi, result.pH.roi);
  }
});

test('landscape client µPAD with reacted color zones registers without perfect fiducial contours', async () => {
  const image = await readFile(new URL('./fixtures/real-client-930-c-fs-landscape.jpg', import.meta.url));
  const { data, info } = await sharp(image).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(info.width, 4064);
  assert.equal(info.height, 3048);
  assert.equal(result.status, 'REGISTERED');
  assertDetectedInnerSensingGeometry(result, info.width, info.height);
  assert.ok(result.square.center.x < result.nitrite.center.x);
  assert.ok(result.nitrite.center.x < result.pH.center.x);
  assert.ok(result.pH.center.x < result.triangle.center.x);
  assert.notDeepEqual(result.nitrite.roi, result.pH.roi);
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

test('soft sensing pads are still required to have detected circle contours', async () => {
  const svg = templateSvg({ extra: '<circle cx="106" cy="50" r="18" fill="#777777"/><circle cx="202" cy="50" r="18" fill="#777777"/>' });
  const { data, info } = await rawSvg(svg);
  const result = detectUPadRegistration(data, info.width, info.height, { debug: true });

  assert.equal(result.status, 'REGISTERED');
  assert.equal(result.nitrite.source, 'detected-contour');
  assert.equal(result.pH.source, 'detected-contour');
  assert.equal(result.diagnostics.finalRejectionReason, null);
  assert.equal(result.diagnostics.zoneEvidence.nitrite.accepted, true);
  assert.equal(result.diagnostics.zoneEvidence.pH.accepted, true);
});

test('production engine reads separate colors from the two detected sensing circles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-separated-roi-colors-'));
  const imagePath = join(directory, 'distinct-pad-colors.png');
  await sharp(Buffer.from(templateSvg())).png().toFile(imagePath);

  try {
    const result = await createColorAnalysisEngine().analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.equal(result.registration.status, 'REGISTERED');
    assert.ok(result.nitrite.measuredRGB[0] > result.pH.measuredRGB[0]);
    assert.ok(result.nitrite.measuredRGB[2] < result.pH.measuredRGB[2]);
    assert.equal(result.nitrite.roi.normalized.shape, 'ellipse');
    assert.equal(result.pH.roi.normalized.shape, 'ellipse');
    assert.equal(result.nitrite.roi.samplingMask, 'ellipse');
    assert.equal(result.pH.roi.samplingMask, 'ellipse');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

test('real client µPAD reaches a completed result when pH reliability is not configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquility-upad-engine-'));
  const imagePath = join(directory, 'client-real.jpg');
  const clientPhoto = await readFile(new URL('./fixtures/real-client-930-aw-1min.jpg', import.meta.url));
  await sharp(clientPhoto).toFile(imagePath);

  try {
    const result = await createColorAnalysisEngine().analyze({ imagePath });

    assert.equal(result.scanStatus, 'Completed');
    assert.equal(result.registration.status, 'REGISTERED');
    assert.equal(result.pH.value, null);
    assert.equal(result.phStatus, 'PH_MEASUREMENT_UNRELIABLE');
    assert.ok(result.nitrite.roi);
    assert.ok(result.pH.roi);
    assert.notDeepEqual(result.nitrite.roi.normalized, result.pH.roi.normalized);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
