/**
 * Image-only registration for the client supplied µPAD template.
 *
 * The client schematic is the source for the normalized template values below.
 * The physical measurements below are documentation metadata only. Feature
 * coordinates are template-relative measurements and must not be interpreted
 * as independent millimetre measurements or used as registration gates.
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
  physicalProportions: Object.freeze({
    overallAspectRatio: 5,
    squareSideToBodyHeight: 0.25,
    triangleSideToBodyHeight: 0.25,
    circleDiameterToBodyHeight: 0.5,
    squareToCircleSpacingToBodyHeight: 0.2625,
    circleToCircleSpacingToBodyHeight: 0.5,
    triangleToCircleSpacingToBodyHeight: 0.2625,
    spacingInterpretation: 'SPACING_REFERENCE_INTERPRETATION_UNCONFIRMED',
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
    // A real triangle can also approximate to 6–9 contour vertices on phone
    // images. Prefer the square's filled bounding-box evidence so it is not
    // assigned as a triangle merely because its softened contour is noisier.
    const fillScore = clamp((shape.fillRatio - 0.6) / 0.35, 0, 1);
    const circularPenalty = clamp((shape.circularity - 0.92) / 0.1, 0, 1);
    return clamp(0.25 * cornerScore + 0.25 * aspectScore + 0.5 * fillScore - 0.25 * circularPenalty, 0, 1);
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
  // Sample only the central 68% of each detected pad radius, excluding its
  // outer rim and adjacent strip/background pixels.
  const sampleRadiusFraction = 0.68;
  const radiusX = Math.max(1, (circle.bounds.width / 2) * sampleRadiusFraction);
  const radiusY = Math.max(1, (circle.bounds.height / 2) * sampleRadiusFraction);
  const centerX = clamp(circle.center.x, 0, width - 1);
  const centerY = clamp(circle.center.y, 0, height - 1);
  const left = clamp(centerX - radiusX, 0, width - 1);
  const top = clamp(centerY - radiusY, 0, height - 1);
  const right = clamp(centerX + radiusX, left + 1, width);
  const bottom = clamp(centerY + radiusY, top + 1, height);
  return {
    x: left / width,
    y: top / height,
    width: (right - left) / width,
    height: (bottom - top) / height,
    shape: 'ellipse',
    center: { x: centerX / width, y: centerY / height },
    radiusX: radiusX / width,
    radiusY: radiusY / height,
    sampleRadiusFraction,
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

function zoneEvidence(pixels, width, height, center, diameter, threshold) {
  const half = Math.max(2, diameter * 0.28);
  const minX = clamp(Math.floor(center.x - half), 0, width - 1);
  const maxX = clamp(Math.ceil(center.x + half), minX, width - 1);
  const minY = clamp(Math.floor(center.y - half), 0, height - 1);
  const maxY = clamp(Math.ceil(center.y + half), minY, height - 1);
  let count = 0;
  let sum = 0;
  let sumSquared = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const offset = (y * width + x) * 3;
      const value = luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      count += 1;
      sum += value;
      sumSquared += value ** 2;
    }
  }
  const meanLuminance = count ? sum / count : 0;
  const variance = count ? Math.max(0, (sumSquared / count) - (meanLuminance ** 2)) : 0;
  return {
    accepted: count > 0 && (meanLuminance >= threshold || Math.sqrt(variance) >= 12),
    center,
    diameter,
    meanLuminance,
    standardDeviation: Math.sqrt(variance),
    sampleCount: count,
  };
}

function summarizeShape(shape, bodyHeightPixels = null) {
  if (!shape) return null;
  const width = Number(shape.bounds?.width) || 0;
  const height = Number(shape.bounds?.height) || 0;
  return {
    center: shape.center || null,
    bbox: shape.bounds || null,
    area: Number.isFinite(shape.area) ? shape.area : null,
    relativeSize: bodyHeightPixels ? ((width + height) / 2) / bodyHeightPixels : null,
    vertexCount: Number.isFinite(shape.corners) ? shape.corners : null,
    confidence: Number.isFinite(shape.confidence) ? shape.confidence : null,
    source: shape.source || 'detected-contour',
  };
}

function makeDiagnostics({ imageWidth, imageHeight, body = null, squareCandidates = [], triangleCandidates = [], circleCandidates = [], selected = null, finalRejectionReason = null, zoneEvidence: evidence = null, brightFeatureCandidateCount = 0, darkFeatureCandidateCount = 0 }) {
  const bodyHeight = body ? Math.min(body.bounds.width, body.bounds.height) : null;
  const selectedSquare = selected?.square || null;
  const selectedTriangle = selected?.triangle || null;
  const axis = selectedSquare && selectedTriangle
    ? projection(selectedTriangle.center, selectedSquare.center, selectedTriangle.center)
    : null;
  return {
    imageWidth,
    imageHeight,
    orientationNormalized: true,
    fullFrameSearch: true,
    bodySearchRegionUsed: false,
    brightFeatureCandidateCount,
    darkFeatureCandidateCount,
    squareCandidateCount: squareCandidates.length,
    triangleCandidateCount: triangleCandidates.length,
    circleCandidateCount: circleCandidates.length,
    selectedSquare: summarizeShape(selectedSquare, bodyHeight),
    selectedTriangle: summarizeShape(selectedTriangle, bodyHeight),
    referencePair: selectedSquare && selectedTriangle ? {
      valid: Boolean(axis && axis.distance > 0),
      axisAngle: axis ? Math.atan2(axis.uy, axis.ux) * 180 / Math.PI : null,
      distance: axis?.distance || null,
      geometryScore: selected?.geometry?.pairConfidence ?? null,
    } : { valid: false, axisAngle: null, distance: null, geometryScore: null },
    bodyEstimate: body ? {
      width: body.bounds.width,
      height: body.bounds.height,
      aspectRatio: Math.max(body.bounds.width, body.bounds.height) / Math.max(1, Math.min(body.bounds.width, body.bounds.height)),
      confidence: body.confidence ?? null,
    } : null,
    nitriteROI: selected?.nitrite ? {
      localized: true,
      center: selected.nitrite.circle.center,
      diameter: selected.nitrite.circle.bounds.width,
      relativeDiameter: bodyHeight ? selected.nitrite.circle.bounds.width / bodyHeight : null,
      source: selected.nitrite.circle.source || 'detected-contour',
    } : { localized: false, center: null, diameter: null, relativeDiameter: null, source: null },
    phROI: selected?.ph ? {
      localized: true,
      center: selected.ph.circle.center,
      diameter: selected.ph.circle.bounds.width,
      relativeDiameter: bodyHeight ? selected.ph.circle.bounds.width / bodyHeight : null,
      source: selected.ph.circle.source || 'detected-contour',
    } : { localized: false, center: null, diameter: null, relativeDiameter: null, source: null },
    zoneEvidence: evidence,
    registrationConfidence: selected?.confidence ?? null,
    physicalPriorScore: null,
    finalRejectionReason,
  };
}

function estimateBodyFromAnchors(square, triangle) {
  // Diagnostic boundary only. Registration acceptance uses the fiducial axis
  // and template-relative ROIs, never this inferred body geometry.
  const axis = projection(triangle.center, square.center, triangle.center);
  if (!axis) return null;
  const templateSpan = UPAD_TEMPLATE.normalized.triangle.x - UPAD_TEMPLATE.normalized.square.x;
  const markerHeight = Math.max(1, (Math.min(square.bounds.width, square.bounds.height)
    + Math.min(triangle.bounds.width, triangle.bounds.height)) / 2);
  const height = markerHeight / UPAD_TEMPLATE.physicalProportions.squareSideToBodyHeight;
  const length = axis.distance / templateSpan;
  return {
    bounds: {
      left: square.center.x,
      top: square.center.y - (height / 2),
      width: length,
      height,
    },
    confidence: 0.45,
    source: 'anchor-derived',
  };
}

function circleWithinImage(circle, width, height) {
  if (!circle?.bounds) return false;
  return circle.bounds.minX >= 0 && circle.bounds.minY >= 0
    && circle.bounds.maxX < width && circle.bounds.maxY < height
    && circle.bounds.width > 1 && circle.bounds.height > 1;
}

function roiWithinImage(roi) {
  return roi && roi.x >= 0 && roi.y >= 0 && roi.width > 0 && roi.height > 0
    && roi.x + roi.width <= 1 && roi.y + roi.height <= 1;
}

function fiducialPairEvidence(square, triangle, width, height) {
  const axis = projection(triangle.center, square.center, triangle.center);
  const diagonal = Math.hypot(width, height);
  const minimumSeparation = Math.max(12, Math.min(width, height) * 0.12);
  const separationRatio = axis && diagonal ? axis.distance / diagonal : 0;
  const valid = Boolean(axis && axis.distance >= minimumSeparation && separationRatio <= 0.95);
  return {
    valid,
    separationRatio,
    score: valid ? clamp((separationRatio - 0.08) / 0.32, 0, 1) : 0,
    axisDistance: axis?.distance || null,
    axisAngle: axis ? Math.atan2(axis.uy, axis.ux) * 180 / Math.PI : null,
  };
}

function chooseRegistration(squareCandidates, triangleCandidates, circleCandidates, body, width, height, pixels, options = {}) {
  const zoneEvidenceThreshold = options.zoneEvidenceThreshold ?? Math.max(options.darkThreshold ?? 90, 100);
  const possible = [];
  let failureCode = 'REFERENCE_PAIR_INVALID';
  for (const square of squareCandidates) {
    for (const triangle of triangleCandidates) {
      const pairEvidence = fiducialPairEvidence(square, triangle, width, height);
      const candidateBody = body || estimateBodyFromAnchors(square, triangle);
      if (!pairEvidence.valid) {
        failureCode = 'REFERENCE_PAIR_INVALID';
        continue;
      }
      const circles = circleCandidates
        .map((circle) => ({ circle, projected: projection(circle.center, square.center, triangle.center) }))
        .filter(({ projected, circle }) => projected && projected.along > 0.04 && projected.along < 0.96
          && Math.abs(projected.across) < 0.2 && circleWithinImage(circle, width, height))
        .map(({ circle, projected }) => ({
          circle,
          projected,
          normalized: templateCoordinate(projected),
        }))
        .sort((left, right) => left.normalized.x - right.normalized.x);
      const nearestCircle = (anchor, excluded) => circles
        .filter((candidate) => candidate !== excluded)
        .sort((left, right) => Math.hypot(left.circle.center.x - anchor.x, left.circle.center.y - anchor.y)
          - Math.hypot(right.circle.center.x - anchor.x, right.circle.center.y - anchor.y))[0];
      // The nearest actual sensing circle to the square is Nitrite; the
      // distinct circle nearest the triangle is pH. Template coordinates are
      // not allowed to synthesize a missing detection zone.
      const nitrite = nearestCircle(square.center, null);
      const ph = nearestCircle(triangle.center, nitrite);
      if (!nitrite) {
        failureCode = 'NITRITE_ROI_INVALID';
        continue;
      }
      if (!ph) {
        failureCode = 'PH_ROI_INVALID';
        continue;
      }
      const nitriteEvidence = zoneEvidence(pixels, width, height, nitrite.circle.center, nitrite.circle.bounds.width, zoneEvidenceThreshold);
      const phEvidence = zoneEvidence(pixels, width, height, ph.circle.center, ph.circle.bounds.width, zoneEvidenceThreshold);
      const nitriteRoi = normalizedCircleRoi(nitrite.circle, width, height);
      const phRoi = normalizedCircleRoi(ph.circle, width, height);
      const sameRoi = ['x', 'y', 'width', 'height'].every((key) => nitriteRoi[key] === phRoi[key]);
      if (!circleWithinImage(nitrite.circle, width, height) || !circleWithinImage(ph.circle, width, height)
        || !roiWithinImage(nitriteRoi) || !roiWithinImage(phRoi) || sameRoi) {
        failureCode = 'REFERENCE_PAIR_INVALID';
        continue;
      }
      if (ph.normalized.x <= nitrite.normalized.x) {
        failureCode = 'REFERENCE_PAIR_INVALID';
        continue;
      }
      const spacing = Math.abs(ph.normalized.x - nitrite.normalized.x);
      if (spacing < 0.04 || !nitriteEvidence.accepted || !phEvidence.accepted) {
        failureCode = 'REFERENCE_PAIR_INVALID';
        continue;
      }
      const anchorConfidence = (square.confidence + triangle.confidence) / 2;
      const roiEvidence = (Number(nitriteEvidence.accepted) + Number(phEvidence.accepted)) / 2;
      const templateConfidence = clamp(1 - (Math.abs(nitrite.normalized.x - UPAD_TEMPLATE.normalized.nitrite.x)
        + Math.abs(ph.normalized.x - UPAD_TEMPLATE.normalized.pH.x)) / 0.5, 0, 1);
      const geometry = {
        referenceScale: 'square-to-triangle-pixel-distance',
        physicalPriorScore: null,
        pairConfidence: pairEvidence.score,
        roiConfidence: roiEvidence,
        templateConfidence,
        detectedZoneCount: 2,
        componentScores: {
          square: square.confidence,
          triangle: triangle.confidence,
          pair: pairEvidence.score,
          roi: roiEvidence,
          template: templateConfidence,
          detectedZones: 1,
        },
      };
      possible.push({
        square,
        triangle,
        nitrite,
        ph,
        body: candidateBody,
        geometry,
        confidence: clamp(
          0.3 * anchorConfidence
            + 0.05 * pairEvidence.score
            + 0.2 * roiEvidence
            + 0.2 * templateConfidence
            + 0.25,
          0,
          1,
        ),
        zoneEvidence: {
          nitrite: nitriteEvidence,
          pH: phEvidence,
        },
      });
    }
  }
  return {
    selected: possible.sort((left, right) => right.confidence - left.confidence)[0] || null,
    failureCode,
  };
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

function componentTouchesBoundary(component, width, height) {
  return component.indices.some((index) => {
    const point = imagePoint(index, width);
    return point.x === 0 || point.y === 0 || point.x === width - 1 || point.y === height - 1;
  });
}

function boundsOverlap(left, right) {
  const overlapWidth = Math.max(0, Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX) + 1);
  const overlapHeight = Math.max(0, Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY) + 1);
  const overlap = overlapWidth * overlapHeight;
  const leftArea = Math.max(1, left.width * left.height);
  const rightArea = Math.max(1, right.width * right.height);
  return overlap / Math.min(leftArea, rightArea);
}

function deduplicateFeatureShapes(shapes) {
  const ordered = [...shapes].sort((left, right) => right.area - left.area);
  const selected = [];
  for (const shape of ordered) {
    const duplicate = selected.some((existing) => {
      const centerDistance = Math.hypot(existing.center.x - shape.center.x, existing.center.y - shape.center.y);
      const size = Math.max(2, Math.max(existing.bounds.width, existing.bounds.height, shape.bounds.width, shape.bounds.height));
      const areaRatio = Math.min(existing.area, shape.area) / Math.max(1, Math.max(existing.area, shape.area));
      return areaRatio >= 0.2
        && (centerDistance <= size * 0.3 || boundsOverlap(existing.bounds, shape.bounds) >= 0.65);
    });
    if (!duplicate) selected.push(shape);
  }
  return selected;
}

function featureShapesForPolarity(pixels, imageWidth, imageHeight, step, thresholds, polarity, minimumArea) {
  const shapes = [];
  for (const threshold of [...new Set(thresholds)].filter((value) => value > 0 && value < 255)) {
    const mask = makeMask(pixels, imageWidth, imageHeight, step, (red, green, blue) => {
      const value = luminance(red, green, blue);
      return polarity === 'bright' ? value >= threshold : value <= threshold;
    });
    const components = connectedComponents(mask.mask, mask.width, mask.height, { minArea: minimumArea });
    for (const component of components) {
      if (componentTouchesBoundary(component, mask.width, mask.height)) continue;
      if (component.area >= mask.width * mask.height * 0.6) continue;
      const shape = mapComponentToOriginal(
        shapeDescriptor(component, mask.width, mask.height),
        step,
        imageWidth,
        imageHeight,
      );
      shapes.push({ ...shape, polarity, threshold });
    }
  }
  return deduplicateFeatureShapes(shapes);
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
  if (!registration?.imageWidth || !registration?.imageHeight) return null;
  const labels = registration.status === 'REGISTERED'
    ? [
      { label: 'REFERENCE POINT 1 — SQUARE', center: registration.square.center, bounds: registration.square.bounds },
      { label: 'REFERENCE POINT 2 — TRIANGLE', center: registration.triangle.center, bounds: registration.triangle.bounds },
      { label: 'NITRITE ZONE', center: registration.nitrite.center, bounds: registration.nitrite.bounds, sampleRoi: registration.nitrite.roi },
      { label: 'pH ZONE', center: registration.pH.center, bounds: registration.pH.bounds, sampleRoi: registration.pH.roi },
    ]
    : [];
  return {
    source: registration.status === 'REGISTERED' ? 'detected-geometry' : 'registration-diagnostics',
    image: { width: registration.imageWidth, height: registration.imageHeight },
    registrationConfidence: registration.registrationConfidence ?? null,
    boundary: registration.body?.bounds || null,
    labels,
    candidates: registration.candidateGroups || null,
    finalRejectionReason: registration.diagnostics?.finalRejectionReason || registration.failureCode || null,
  };
}

export function buildUPadDiagnosticOverlaySvg(registration) {
  const overlay = createUPadDiagnosticOverlay(registration);
  if (!overlay?.image?.width || !overlay?.image?.height) return null;
  const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2'];
  const boundary = overlay.boundary || { left: 0, top: 0, width: overlay.image.width, height: overlay.image.height };
  const labels = overlay.labels.map((item, index) => {
    const displayLabel = item.label === 'REFERENCE POINT 1 — SQUARE'
      ? 'SQUARE FIDUCIAL'
      : item.label === 'REFERENCE POINT 2 — TRIANGLE'
        ? 'TRIANGLE FIDUCIAL'
        : item.label;
    const sampleCenterX = item.sampleRoi?.center?.x * overlay.image.width;
    const sampleCenterY = item.sampleRoi?.center?.y * overlay.image.height;
    const sampleRadiusY = item.sampleRoi?.radiusY * overlay.image.height;
    const textY = item.label === 'NITRITE ZONE'
      ? sampleCenterY - sampleRadiusY - 8
      : item.label === 'pH ZONE'
        ? sampleCenterY + sampleRadiusY + 18
        : item.bounds.minY - 8;
    return `<g data-label="${escapeXml(item.label)}" stroke="${colors[index]}" fill="none">
    <rect x="${item.bounds.minX}" y="${item.bounds.minY}" width="${item.bounds.width}" height="${item.bounds.height}" stroke-width="2"/>
    ${item.sampleRoi?.shape === 'ellipse' ? `<ellipse data-sample="${escapeXml(item.label.startsWith('NITRITE') ? 'NITRITE' : 'pH')}" cx="${sampleCenterX}" cy="${sampleCenterY}" rx="${item.sampleRoi.radiusX * overlay.image.width}" ry="${sampleRadiusY}" stroke-width="3"/>` : ''}
    <circle cx="${item.center.x}" cy="${item.center.y}" r="3" fill="${colors[index]}"/>
    <text x="${item.center.x}" y="${textY}" text-anchor="middle" fill="${colors[index]}" stroke="none" font-size="12">${escapeXml(displayLabel)}</text>
  </g>`;
  }).join('');
  const candidateMarkup = overlay.candidates
    ? Object.entries(overlay.candidates).flatMap(([type, candidates]) => (candidates || []).map((candidate) => {
      if (!candidate?.bbox || !candidate?.center) return '';
      const color = type === 'square' ? '#ffd166' : type === 'triangle' ? '#ef476f' : '#8ecae6';
      return `<rect data-candidate="${escapeXml(type)}" x="${candidate.bbox.minX}" y="${candidate.bbox.minY}" width="${candidate.bbox.width}" height="${candidate.bbox.height}" fill="none" stroke="${color}" stroke-dasharray="4 2" stroke-width="1"/>`;
    })).join('')
    : '';
  const rejection = overlay.finalRejectionReason
    ? `<text x="8" y="40" fill="#ff595e" font-size="14">rejection: ${escapeXml(overlay.finalRejectionReason)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${overlay.image.width}" height="${overlay.image.height}" viewBox="0 0 ${overlay.image.width} ${overlay.image.height}">
    <rect x="${boundary.left}" y="${boundary.top}" width="${boundary.width}" height="${boundary.height}" fill="none" stroke="#ffffff" stroke-width="2"/>
    ${candidateMarkup}
    ${labels}
    <text x="8" y="20" fill="#ffffff" font-size="14">registration confidence: ${overlay.registrationConfidence == null ? 'n/a' : Number(overlay.registrationConfidence).toFixed(3)}</text>
    ${rejection}
  </svg>`;
}

export function detectUPadRegistration(pixels, imageWidth, imageHeight, options = {}) {
  if (!Buffer.isBuffer(pixels) || pixels.length !== imageWidth * imageHeight * 3) {
    throw new TypeError('µPAD registration requires an RGB buffer matching image dimensions.');
  }
  const config = { ...DEFAULT_OPTIONS, ...options };
  const step = Math.max(1, Math.ceil(Math.max(imageWidth, imageHeight) / config.maxDetectionDimension));
  const minimumCandidateArea = Math.max(
    config.minimumFeatureArea,
    Math.ceil(Math.ceil(imageWidth / step) * Math.ceil(imageHeight / step) * 0.00005),
  );
  const darkMask = makeMask(pixels, imageWidth, imageHeight, step, (red, green, blue) => luminance(red, green, blue) <= config.darkThreshold);
  const bodyCandidates = connectedComponents(darkMask.mask, darkMask.width, darkMask.height, { minArea: config.minimumBodyArea });
  const body = bodyCandidates
    .map((component) => ({
      ...component,
      bounds: mapBoundaryToImage(component.bounds, step, imageWidth, imageHeight),
      confidence: component.area / Math.max(1, component.bounds.width * component.bounds.height),
    }))
    .filter((component) => Math.max(component.bounds.width, component.bounds.height)
      >= Math.min(component.bounds.width, component.bounds.height) * 1.8)
    .sort((left, right) => right.area - left.area)[0];
  // Fiducials are searched across the complete usable frame. The body contour
  // remains diagnostic-only; shadows and background objects must not hide valid
  // square, triangle, or sensing-zone candidates behind a body bounding box.
  const brightThresholds = [
    config.featureThreshold - 24,
    config.featureThreshold,
    config.featureThreshold + 24,
    config.featureThreshold + 48,
    config.featureThreshold + 72,
  ].map((value) => clamp(value, 24, 240));
  const darkThresholds = [
    config.darkThreshold - 24,
    config.darkThreshold,
    config.darkThreshold + 24,
    config.darkThreshold + 48,
    config.darkThreshold + 72,
  ].map((value) => clamp(value, 16, 232));
  const brightShapes = featureShapesForPolarity(
    pixels,
    imageWidth,
    imageHeight,
    step,
    brightThresholds,
    'bright',
    minimumCandidateArea,
  );
  const darkShapes = featureShapesForPolarity(
    pixels,
    imageWidth,
    imageHeight,
    step,
    darkThresholds,
    'dark',
    minimumCandidateArea,
  );
  const shapes = deduplicateFeatureShapes([...brightShapes, ...darkShapes]);

  const squareCandidates = shapes
    .filter((shape) => shape.corners >= 3 && shape.corners <= 20 && shape.aspectRatio <= 1.65 && shape.fillRatio >= 0.42)
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'square') }))
    // Real phone images can fragment/soften a square's contour into more than
    // twelve hull vertices. The paired triangle, ordered sensing zones, and
    // template relation remain the joint acceptance gate.
    .filter((shape) => shape.confidence >= 0.24);
  const triangleCandidates = shapes
    .filter((shape) => shape.corners >= 3 && shape.corners <= 20
      && shape.aspectRatio <= 2.1 && shape.fillRatio >= 0.24
      && !(shape.circularity > 0.92 && shape.fillRatio > 0.8)
      && (shape.corners <= 8 || shape.circularity < 0.95))
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'triangle') }))
    .filter((shape) => shape.confidence >= 0.45);
  const circleCandidates = shapes
    .filter((shape) => shape.corners >= 6 && shape.aspectRatio <= 1.45 && shape.fillRatio >= 0.42)
    .map((shape) => ({ ...shape, confidence: shapeConfidence(shape, 'circle') }))
    .filter((shape) => shape.confidence >= 0.55);
  const selection = chooseRegistration(squareCandidates, triangleCandidates, circleCandidates, body, imageWidth, imageHeight, pixels, config);
  const selected = selection.selected;
  const minimumRegistrationConfidence = config.minimumRegistrationConfidence ?? 0.45;
  if (!selected || selected.confidence < minimumRegistrationConfidence) {
    const failureCode = selected && selected.confidence < minimumRegistrationConfidence
      ? 'REGISTRATION_CONFIDENCE_TOO_LOW'
      : squareCandidates.length === 0
      ? 'SQUARE_NOT_FOUND'
      : triangleCandidates.length === 0
        ? 'TRIANGLE_NOT_FOUND'
      : circleCandidates.length === 0
          ? 'NITRITE_ROI_INVALID'
          : selection.failureCode;
    return {
      status: 'REFERENCE_MARKS_NOT_FOUND',
      reason: 'EXPECTED_SQUARE_TRIANGLE_CIRCLE_RELATIONSHIP_NOT_FOUND',
      failureCode,
      imageWidth,
      imageHeight,
      template: UPAD_TEMPLATE,
      body: body ? { bounds: body.bounds, source: body.source || 'detected-body' } : null,
      candidates: { square: squareCandidates.length, triangle: triangleCandidates.length, circle: circleCandidates.length },
      candidateDetails: config.debug ? shapes.map(({ indices, hull, ...shape }) => shape) : undefined,
      candidateGroups: config.debug ? {
        square: squareCandidates.map((shape) => summarizeShape(shape, body ? Math.min(body.bounds.width, body.bounds.height) : null)),
        triangle: triangleCandidates.map((shape) => summarizeShape(shape, body ? Math.min(body.bounds.width, body.bounds.height) : null)),
        circle: circleCandidates.map((shape) => summarizeShape(shape, body ? Math.min(body.bounds.width, body.bounds.height) : null)),
      } : undefined,
      diagnostics: makeDiagnostics({
        imageWidth,
        imageHeight,
        body: body || selected?.body || null,
        squareCandidates,
        triangleCandidates,
        circleCandidates,
        selected,
        finalRejectionReason: failureCode,
        zoneEvidence: selected?.zoneEvidence || null,
        brightFeatureCandidateCount: brightShapes.length,
        darkFeatureCandidateCount: darkShapes.length,
      }),
    };
  }

  const toRegistration = (item) => {
    const projectionResult = projection(item.center, selected.square.center, selected.triangle.center);
    return {
      center: item.center,
      bounds: item.bounds,
      confidence: item.confidence,
      source: item.source || 'detected-contour',
      normalized: projectionResult ? templateCoordinate(projectionResult) : null,
    };
  };
  const registration = {
    status: 'REGISTERED',
    imageWidth,
    imageHeight,
    template: UPAD_TEMPLATE,
    body: { bounds: selected.body.bounds, source: selected.body.source || 'detected-body' },
    candidates: { square: squareCandidates.length, triangle: triangleCandidates.length, circle: circleCandidates.length },
    geometry: selected.geometry,
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
  registration.candidateGroups = config.debug ? {
    square: squareCandidates.map((shape) => summarizeShape(shape, Math.min(selected.body.bounds.width, selected.body.bounds.height))),
    triangle: triangleCandidates.map((shape) => summarizeShape(shape, Math.min(selected.body.bounds.width, selected.body.bounds.height))),
    circle: circleCandidates.map((shape) => summarizeShape(shape, Math.min(selected.body.bounds.width, selected.body.bounds.height))),
  } : undefined;
  registration.diagnostics = makeDiagnostics({
    imageWidth,
    imageHeight,
    body: selected.body,
    squareCandidates,
    triangleCandidates,
    circleCandidates,
    selected,
    finalRejectionReason: null,
    zoneEvidence: selected.zoneEvidence,
    brightFeatureCandidateCount: brightShapes.length,
    darkFeatureCandidateCount: darkShapes.length,
  });
  registration.overlay = createUPadDiagnosticOverlay(registration);
  if (config.debug) registration.candidateDetails = shapes.map(({ indices, hull, ...shape }) => shape);
  return registration;
}
