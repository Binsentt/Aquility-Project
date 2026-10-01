/**
 * Image-only registration for the client supplied µPAD template.
 *
 * The client schematic is the source for the normalized template values below.
 * Only the overall length, body height, and 5 mm sensing-circle diameter are
 * physical dimensions supplied by the client. Feature coordinates are
 * template-relative measurements and must not be interpreted as independent
 * millimetre measurements.
 */

export const UPAD_TEMPLATE = Object.freeze({
  source: 'client-schematic-image',
  lengthMm: 50,
  bodyHeightMm: 10,
  sensingCircleDiameterMm: 5,
  sensingCircleDimensionMeaning: 'diameter of the sensing circle shown by the 5 mm extension lines',
  physicalMeasurements: Object.freeze({
    squareSideMm: 2.5,
    triangleSideMm: 2.5,
    outerReferenceSpacingMm: 2.625,
    circleSpacingMm: 5,
    spacingInterpretation: 'ambiguous-edge-versus-center',
    provenance: 'CLIENT_PHYSICAL_MEASUREMENT',
  }),
  schematicCoordinateProvenance: 'CLIENT_SCHEMATIC_DERIVED',
  normalized: Object.freeze({
    square: Object.freeze({ x: 0.079, y: 0.5, width: 0.04, height: 0.2 }),
    nitrite: Object.freeze({ x: 0.201, y: 0.5, radius: 0.05 }),
    pH: Object.freeze({ x: 0.401, y: 0.5, radius: 0.05 }),
    triangle: Object.freeze({ x: 0.522, y: 0.5, width: 0.04, height: 0.2 }),
  }),
});

const DEFAULT_OPTIONS = Object.freeze({
  darkThreshold: 90,
  featureThreshold: 120,
  maxDetectionDimension: 1200,
  minimumBodyArea: 120,
  minimumFeatureArea: 8,
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const luminance = (red, green, blue) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;

function imagePoint(index, width, channels = 3) {
  const x = index % width;
  const y = Math.floor(index / width);
  return { x, y, channels };
}

function componentBounds(indices, width) {
  let minX = width;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  for (const index of indices) {
    const point = imagePoint(index, width);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function connectedComponents(mask, width, height, { minArea = 1, region = null } = {}) {
  const visited = new Uint8Array(width * height);
  const components = [];
  const minX = region?.minX ?? 0;
  const minY = region?.minY ?? 0;
  const maxX = region?.maxX ?? width - 1;
  const maxY = region?.maxY ?? height - 1;
  const neighbors = [-1, 0, 1];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const start = y * width + x;
      if (visited[start] || !mask[start]) continue;
      const queue = [start];
      const indices = [];
      visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        indices.push(index);
        const point = imagePoint(index, width);
        for (const dy of neighbors) {
          for (const dx of neighbors) {
            if (dx === 0 && dy === 0) continue;
            const nx = point.x + dx;
            const ny = point.y + dy;
            if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
            const next = ny * width + nx;
            if (!visited[next] && mask[next]) {
              visited[next] = 1;
              queue.push(next);
            }
          }
        }
      }
      if (indices.length >= minArea) {
        components.push({ indices, bounds: componentBounds(indices, width), area: indices.length });
      }
    }
  }
  return components;
}

function convexHull(points) {
  const sorted = [...points]
    .sort((left, right) => left.x - right.x || left.y - right.y)
    .filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
  if (sorted.length <= 1) return sorted;
  const cross = (origin, point, target) => ((point.x - origin.x) * (target.y - origin.y)) - ((point.y - origin.y) * (target.x - origin.x));
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function boundaryPoints(component, width, height) {
  const pixels = new Set(component.indices);
  const points = [];
  for (const index of component.indices) {
    const point = imagePoint(index, width);
    const touchesOutside = point.x === 0 || point.y === 0 || point.x === width - 1 || point.y === height - 1
      || !pixels.has(index - 1) || !pixels.has(index + 1) || !pixels.has(index - width) || !pixels.has(index + width);
    if (touchesOutside) points.push({ x: point.x + 0.5, y: point.y + 0.5 });
  }
  return points;
}

function polygonPerimeter(points) {
  if (points.length < 2) return 0;
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

function shapeDescriptor(component, width, height) {
  const { bounds, area } = component;
  const boundary = boundaryPoints(component, width, height);
  const hull = convexHull(boundary);
  const perimeter = polygonPerimeter(hull);
  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));
  const fillRatio = area / Math.max(1, bounds.width * bounds.height);
  const circularity = perimeter ? (4 * Math.PI * area) / (perimeter ** 2) : 0;
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  return { ...component, hull, corners: hull.length, aspectRatio, fillRatio, circularity, center };
}

function shapeConfidence(shape, expected) {
  if (expected === 'square') {
    const cornerScore = 1 - Math.min(1, Math.abs(shape.corners - 4) / 5);
    const aspectScore = 1 - Math.min(1, Math.abs(shape.aspectRatio - 1) / 0.7);
    const fillScore = clamp((shape.fillRatio - 0.45) / 0.45, 0, 1);
    const circularPenalty = clamp((shape.circularity - 0.92) / 0.1, 0, 1);
    return clamp(0.45 * cornerScore + 0.35 * aspectScore + 0.2 * fillScore - 0.25 * circularPenalty, 0, 1);
  }
  if (expected === 'triangle') {
    const cornerScore = shape.corners >= 6 && shape.corners <= 9 && shape.circularity < 0.95
      ? 0.55
      : 1 - Math.min(1, Math.abs(shape.corners - 3) / 5);
    const aspectScore = 1 - Math.min(1, Math.abs(shape.aspectRatio - 1.1) / 1.4);
    const fillScore = clamp((shape.fillRatio - 0.25) / 0.5, 0, 1);
    return clamp(0.5 * cornerScore + 0.3 * aspectScore + 0.2 * fillScore, 0, 1);
  }
  return clamp(0.45 * clamp((shape.circularity - 0.55) / 0.45, 0, 1)
    + 0.3 * clamp((shape.fillRatio - 0.45) / 0.5, 0, 1)
    + 0.25 * clamp(1 - Math.abs(shape.aspectRatio - 1) / 0.5, 0, 1), 0, 1);
}

function mapComponentToOriginal(shape, step, width, height) {
  const bounds = {
    minX: shape.bounds.minX * step,
    minY: shape.bounds.minY * step,
    maxX: Math.min(width - 1, ((shape.bounds.maxX + 1) * step) - 1),
    maxY: Math.min(height - 1, ((shape.bounds.maxY + 1) * step) - 1),
  };
  bounds.width = bounds.maxX - bounds.minX + 1;
  bounds.height = bounds.maxY - bounds.minY + 1;
  return {
    ...shape,
    bounds,
    center: {
      x: ((shape.center.x + 0.5) * step) - 0.5,
      y: ((shape.center.y + 0.5) * step) - 0.5,
    },
  };
}

function normalizedCircleRoi(circle, width, height) {
  const insetX = circle.bounds.width * 0.16;
  const insetY = circle.bounds.height * 0.16;
  const left = clamp(circle.bounds.minX + insetX, 0, width - 1);
  const top = clamp(circle.bounds.minY + insetY, 0, height - 1);
  const right = clamp(circle.bounds.maxX - insetX + 1, left + 1, width);
  const bottom = clamp(circle.bounds.maxY - insetY + 1, top + 1, height);
  return {
    x: left / width,
    y: top / height,
    width: (right - left) / width,
    height: (bottom - top) / height,
  };
}

function projection(point, square, triangle) {
  const dx = triangle.x - square.x;
  const dy = triangle.y - square.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return null;
  const ux = dx / distance;
  const uy = dy / distance;
  const vx = -uy;
  const vy = ux;
  const px = point.x - square.x;
  const py = point.y - square.y;
  return {
    along: (px * ux + py * uy) / distance,
    across: (px * vx + py * vy) / distance,
    distance,
    ux,
    uy,
    vx,
    vy,
  };
}

function templateCoordinate(projectionResult) {
  return {
    x: UPAD_TEMPLATE.normalized.square.x
      + projectionResult.along * (UPAD_TEMPLATE.normalized.triangle.x - UPAD_TEMPLATE.normalized.square.x),
    y: UPAD_TEMPLATE.normalized.square.y + projectionResult.across
      * (UPAD_TEMPLATE.normalized.triangle.x - UPAD_TEMPLATE.normalized.square.x),
  };
}

function chooseRegistration(squareCandidates, triangleCandidates, circleCandidates, body, width, height) {
  const bodyDiagonal = Math.hypot(body.bounds.width, body.bounds.height);
  const possible = [];
  for (const square of squareCandidates) {
    for (const triangle of triangleCandidates) {
      const axis = projection(triangle.center, square.center, triangle.center);
      if (!axis || axis.distance < bodyDiagonal * 0.3 || axis.distance > bodyDiagonal * 0.75) continue;
      if (Math.abs(triangle.center.y - square.center.y) > body.bounds.height * 0.85) continue;
      const circles = circleCandidates
        .map((circle) => ({ circle, projected: projection(circle.center, square.center, triangle.center) }))
        .filter(({ projected }) => projected && projected.along > 0.08 && projected.along < 0.95
          && Math.abs(projected.across) < 0.4)
        .map(({ circle, projected }) => ({
          circle,
          projected,
          normalized: templateCoordinate(projected),
          xDistance: Math.abs(templateCoordinate(projected).x - circle.expectedX),
        }))
        .sort((left, right) => left.xDistance - right.xDistance);
      const nitrite = circles.find(({ normalized }) => Math.abs(normalized.x - UPAD_TEMPLATE.normalized.nitrite.x) < 0.14);
      const ph = circles.find(({ normalized }) => Math.abs(normalized.x - UPAD_TEMPLATE.normalized.pH.x) < 0.14
        && (!nitrite || Math.abs(normalized.x - nitrite.normalized.x) > 0.08));
      if (!nitrite || !ph || ph.normalized.x <= nitrite.normalized.x) continue;
      const spacing = Math.abs(ph.normalized.x - nitrite.normalized.x);
      if (spacing < 0.08) continue;
      const anchorConfidence = (square.confidence + triangle.confidence) / 2;
      const circleConfidence = (nitrite.circle.confidence + ph.circle.confidence) / 2;
      const geometryConfidence = clamp(1 - (Math.abs(nitrite.normalized.x - UPAD_TEMPLATE.normalized.nitrite.x)
        + Math.abs(ph.normalized.x - UPAD_TEMPLATE.normalized.pH.x)) / 0.25, 0, 1);
      possible.push({ square, triangle, nitrite, ph, confidence: clamp(0.4 * anchorConfidence + 0.35 * circleConfidence + 0.25 * geometryConfidence, 0, 1) });
    }
  }
  return possible.sort((left, right) => right.confidence - left.confidence)[0] || null;
}

function makeMask(pixels, width, height, step, predicate) {
  const sampledWidth = Math.ceil(width / step);
  const sampledHeight = Math.ceil(height / step);
  const mask = new Uint8Array(sampledWidth * sampledHeight);
  for (let y = 0; y < sampledHeight; y += 1) {
    for (let x = 0; x < sampledWidth; x += 1) {
      const sourceX = Math.min(width - 1, x * step);
      const sourceY = Math.min(height - 1, y * step);
      const offset = (sourceY * width + sourceX) * 3;
      mask[y * sampledWidth + x] = predicate(pixels[offset], pixels[offset + 1], pixels[offset + 2]) ? 1 : 0;
    }
  }
  return { mask, width: sampledWidth, height: sampledHeight };
}

function mapBoundaryToImage(bounds, step, width, height) {
  return {
    left: clamp(bounds.minX * step, 0, width - 1),
    top: clamp(bounds.minY * step, 0, height - 1),
    width: clamp(bounds.width * step, 1, width),
    height: clamp(bounds.height * step, 1, height),
  };
}

export function createUPadDiagnosticOverlay(registration) {
  if (!registration || registration.status !== 'REGISTERED') return null;
  return {
    source: 'detected-geometry',
    image: { width: registration.imageWidth, height: registration.imageHeight },
    registrationConfidence: registration.registrationConfidence,
    boundary: registration.body?.bounds || null,
    labels: [
      { label: 'REFERENCE POINT 1 — SQUARE', center: registration.square.center, bounds: registration.square.bounds },
      { label: 'REFERENCE POINT 2 — TRIANGLE', center: registration.triangle.center, bounds: registration.triangle.bounds },
      { label: 'NITRITE ZONE', center: registration.nitrite.center, bounds: registration.nitrite.bounds },
      { label: 'pH ZONE', center: registration.pH.center, bounds: registration.pH.bounds },
    ],
  };
}

export function buildUPadDiagnosticOverlaySvg(registration) {
  const overlay = createUPadDiagnosticOverlay(registration);
  if (!overlay?.image?.width || !overlay?.image?.height) return null;
  const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2'];
  const labels = overlay.labels.map((item, index) => `<g data-label="${escapeXml(item.label)}" stroke="${colors[index]}" fill="none">
    <rect x="${item.bounds.minX}" y="${item.bounds.minY}" width="${item.bounds.width}" height="${item.bounds.height}" stroke-width="2"/>
    <circle cx="${item.center.x}" cy="${item.center.y}" r="3" fill="${colors[index]}"/>
    <text x="${item.center.x + 5}" y="${item.center.y - 5}" fill="${colors[index]}" stroke="none" font-size="12">${escapeXml(item.label)}</text>
  </g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${overlay.image.width}" height="${overlay.image.height}" viewBox="0 0 ${overlay.image.width} ${overlay.image.height}">
    <rect x="${overlay.boundary.left}" y="${overlay.boundary.top}" width="${overlay.boundary.width}" height="${overlay.boundary.height}" fill="none" stroke="#ffffff" stroke-width="2"/>
    ${labels}
    <text x="8" y="20" fill="#ffffff" font-size="14">registration confidence: ${Number(overlay.registrationConfidence).toFixed(3)}</text>
  </svg>`;
}

export function detectUPadRegistration(pixels, imageWidth, imageHeight, options = {}) {
  if (!Buffer.isBuffer(pixels) || pixels.length !== imageWidth * imageHeight * 3) {
    throw new TypeError('µPAD registration requires an RGB buffer matching image dimensions.');
  }
  const config = { ...DEFAULT_OPTIONS, ...options };
  const step = Math.max(1, Math.ceil(Math.max(imageWidth, imageHeight) / config.maxDetectionDimension));
  const darkMask = makeMask(pixels, imageWidth, imageHeight, step, (red, green, blue) => luminance(red, green, blue) <= config.darkThreshold);
  const bodyCandidates = connectedComponents(darkMask.mask, darkMask.width, darkMask.height, { minArea: config.minimumBodyArea });
  const body = bodyCandidates
    .map((component) => ({ ...component, bounds: mapBoundaryToImage(component.bounds, step, imageWidth, imageHeight) }))
    .filter((component) => Math.max(component.bounds.width, component.bounds.height)
      >= Math.min(component.bounds.width, component.bounds.height) * 1.8)
    .sort((left, right) => right.area - left.area)[0];
  if (!body) return { status: 'UPAD_NOT_DETECTED', reason: 'STRIP_BODY_NOT_FOUND', template: UPAD_TEMPLATE };

  const bodyGridBounds = componentBounds(bodyCandidates.find((candidate) => candidate.area === body.area)?.indices || [], darkMask.width);
  const featureMask = makeMask(pixels, imageWidth, imageHeight, step, (red, green, blue) => luminance(red, green, blue) >= config.featureThreshold);
  const featureComponents = connectedComponents(featureMask.mask, featureMask.width, featureMask.height, {
    minArea: config.minimumFeatureArea,
    region: {
      minX: clamp(bodyGridBounds.minX, 0, featureMask.width - 1),
      minY: clamp(bodyGridBounds.minY, 0, featureMask.height - 1),
      maxX: clamp(bodyGridBounds.maxX, 0, featureMask.width - 1),
      maxY: clamp(bodyGridBounds.maxY, 0, featureMask.height - 1),
    },
  });
  const shapes = featureComponents
    .filter((component) => !component.indices.some((index) => {
      const point = imagePoint(index, featureMask.width);
      return point.x === bodyGridBounds.minX || point.x === bodyGridBounds.maxX
        || point.y === bodyGridBounds.minY || point.y === bodyGridBounds.maxY;
    }))
    .map((component) => shapeDescriptor(component, featureMask.width, featureMask.height))
    .map((shape) => mapComponentToOriginal(shape, step, imageWidth, imageHeight));

  const squareCandidates = shapes
    .filter((shape) => shape.corners >= 3 && shape.corners <= 5 && shape.aspectRatio <= 1.55 && shape.fillRatio >= 0.48)
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'square') }))
    .filter((shape) => shape.confidence >= 0.45);
  const triangleCandidates = shapes
    .filter((shape) => shape.corners >= 3 && shape.corners <= 20 && shape.corners !== 6
      && shape.aspectRatio <= 2.1 && shape.fillRatio >= 0.24
      && !(shape.circularity > 0.92 && shape.fillRatio > 0.8)
      && (shape.corners <= 8 || shape.circularity < 0.95))
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'triangle') }))
    .filter((shape) => shape.confidence >= 0.45);
  const circleCandidates = shapes
    .filter((shape) => shape.corners >= 6 && shape.aspectRatio <= 1.45 && shape.fillRatio >= 0.42)
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'circle'), expectedX: UPAD_TEMPLATE.normalized.nitrite.x }));
  const selected = chooseRegistration(squareCandidates, triangleCandidates, circleCandidates, body, imageWidth, imageHeight);
  if (!selected) {
    return {
      status: 'REFERENCE_MARKS_NOT_FOUND',
      reason: 'EXPECTED_SQUARE_TRIANGLE_CIRCLE_RELATIONSHIP_NOT_FOUND',
      template: UPAD_TEMPLATE,
      body: { bounds: body.bounds },
      candidates: { square: squareCandidates.length, triangle: triangleCandidates.length, circle: circleCandidates.length },
      candidateDetails: config.debug ? shapes.map(({ indices, hull, ...shape }) => shape) : undefined,
    };
  }

  const toRegistration = (item) => {
    const projectionResult = projection(item.center, selected.square.center, selected.triangle.center);
    return {
      center: item.center,
      bounds: item.bounds,
      confidence: item.confidence,
      normalized: projectionResult ? templateCoordinate(projectionResult) : null,
    };
  };
  const registration = {
    status: 'REGISTERED',
    imageWidth,
    imageHeight,
    template: UPAD_TEMPLATE,
    body: { bounds: body.bounds },
    square: toRegistration(selected.square),
    triangle: toRegistration(selected.triangle),
    nitrite: {
      ...toRegistration(selected.nitrite.circle),
      roi: normalizedCircleRoi(selected.nitrite.circle, imageWidth, imageHeight),
      zone: 'nitrite',
    },
    pH: {
      ...toRegistration(selected.ph.circle),
      roi: normalizedCircleRoi(selected.ph.circle, imageWidth, imageHeight),
      zone: 'pH',
    },
    transform: {
      origin: selected.square.center,
      axis: { x: selected.triangle.center.x - selected.square.center.x, y: selected.triangle.center.y - selected.square.center.y },
      scalePixelsPerTemplateUnit: selected.triangle.center.x === selected.square.center.x && selected.triangle.center.y === selected.square.center.y
        ? null
        : Math.hypot(selected.triangle.center.x - selected.square.center.x, selected.triangle.center.y - selected.square.center.y)
          / (UPAD_TEMPLATE.normalized.triangle.x - UPAD_TEMPLATE.normalized.square.x),
      rotationDegrees: Math.atan2(selected.triangle.center.y - selected.square.center.y, selected.triangle.center.x - selected.square.center.x) * 180 / Math.PI,
      perspectiveCorrection: 'not-applied; similarity registration from square-to-triangle anchors',
    },
    registrationConfidence: selected.confidence,
  };
  registration.overlay = createUPadDiagnosticOverlay(registration);
  if (config.debug) registration.candidateDetails = shapes.map(({ indices, hull, ...shape }) => shape);
  return registration;
}
