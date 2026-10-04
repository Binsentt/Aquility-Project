const D65 = { x: 0.95047, y: 1, z: 1.08883 };
const radians = (value) => value * Math.PI / 180;
const degrees = (value) => value * 180 / Math.PI;

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function extractRoiStatistics(pixels, imageWidth, imageHeight, roi) {
  if (!Buffer.isBuffer(pixels) || pixels.length !== imageWidth * imageHeight * 3) {
    throw new TypeError('ROI pixels must be an RGB buffer matching the image dimensions.');
  }
  if (!roi || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(roi[key]))) {
    throw new TypeError('ROI must contain normalized x, y, width, and height values.');
  }
  if (roi.x < 0 || roi.y < 0 || roi.width <= 0 || roi.height <= 0 || roi.x + roi.width > 1 || roi.y + roi.height > 1) {
    throw new RangeError('ROI must fit within normalized image bounds.');
  }
  const ellipseMask = roi.shape === 'ellipse';
  if (ellipseMask && (!Number.isFinite(roi.center?.x) || !Number.isFinite(roi.center?.y)
    || !Number.isFinite(roi.radiusX) || !Number.isFinite(roi.radiusY)
    || roi.radiusX <= 0 || roi.radiusY <= 0
    || roi.center.x - roi.radiusX < 0 || roi.center.y - roi.radiusY < 0
    || roi.center.x + roi.radiusX > 1 || roi.center.y + roi.radiusY > 1)) {
    throw new RangeError('Ellipse ROI must contain valid normalized center and radius values within the image.');
  }

  const left = Math.min(imageWidth - 1, Math.floor(roi.x * imageWidth));
  const top = Math.min(imageHeight - 1, Math.floor(roi.y * imageHeight));
  const right = Math.min(imageWidth, Math.max(left + 1, Math.ceil((roi.x + roi.width) * imageWidth)));
  const bottom = Math.min(imageHeight, Math.max(top + 1, Math.ceil((roi.y + roi.height) * imageHeight)));
  const red = [];
  const green = [];
  const blue = [];
  const luminance = [];

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (ellipseMask) {
        const dx = (x + 0.5 - roi.center.x * imageWidth) / (roi.radiusX * imageWidth);
        const dy = (y + 0.5 - roi.center.y * imageHeight) / (roi.radiusY * imageHeight);
        if ((dx ** 2) + (dy ** 2) > 1) continue;
      }
      const offset = (y * imageWidth + x) * 3;
      const channels = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
      red.push(channels[0]);
      green.push(channels[1]);
      blue.push(channels[2]);
      luminance.push(0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]);
    }
  }

  if (red.length === 0) throw new RangeError('ROI sampling shape contains no image pixels.');

  const medianLuminance = median(luminance);
  const mad = median(luminance.map((value) => Math.abs(value - medianLuminance)));
  const cutoff = mad === 0 ? 0 : 3 * 1.4826 * mad;
  const selected = luminance
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => Math.abs(value - medianLuminance) <= cutoff)
    .map(({ index }) => index);
  const retained = selected.length ? selected : luminance.map((_, index) => index);

  return {
    measuredRGB: [
      median(retained.map((index) => red[index])),
      median(retained.map((index) => green[index])),
      median(retained.map((index) => blue[index])),
    ],
    sampleCount: retained.length,
    roiPixels: ellipseMask
      ? { left, top, width: right - left, height: bottom - top, sampleShape: 'ellipse', candidatePixelCount: red.length }
      : { left, top, width: right - left, height: bottom - top },
    statistic: `per-channel-median-with-luminance-outlier-filter${ellipseMask ? '-and-ellipse-mask' : ''}`,
  };
}

export function rgbToLab([red, green, blue]) {
  const linearize = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [red, green, blue].map(linearize);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65.x;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / D65.z;
  const delta = 6 / 29;
  const f = (value) => value > delta ** 3 ? Math.cbrt(value) : value / (3 * delta ** 2) + 4 / 29;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToHsv([red, green, blue]) {
  const channels = [red, green, blue].map((channel) => channel / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const chroma = maximum - minimum;
  let hue = 0;

  if (chroma !== 0) {
    if (maximum === channels[0]) hue = 60 * (((channels[1] - channels[2]) / chroma) % 6);
    else if (maximum === channels[1]) hue = 60 * ((channels[2] - channels[0]) / chroma + 2);
    else hue = 60 * ((channels[0] - channels[1]) / chroma + 4);
  }

  return { hue: (hue + 360) % 360, saturation: maximum === 0 ? 0 : chroma / maximum, value: maximum };
}

export function assessColorQuality(rgb, {
  minimumSaturation = 0.08,
  minimumValue = 0.05,
  maximumLowSaturationValue = 0.995,
} = {}) {
  const hsv = rgbToHsv(rgb);
  const reasons = [];
  if (hsv.saturation < minimumSaturation) reasons.push('LOW_SATURATION');
  if (hsv.value < minimumValue) reasons.push('UNDEREXPOSED');
  if (hsv.value >= maximumLowSaturationValue && hsv.saturation < 0.15) reasons.push('OVEREXPOSED');
  return {
    reliable: reasons.length === 0,
    status: reasons.length === 0 ? 'IMAGE_QUALITY_ACCEPTABLE' : 'IMAGE_QUALITY_INSUFFICIENT',
    reasons,
    hue: hsv.hue,
    saturation: hsv.saturation,
    value: hsv.value,
  };
}

export function deltaE00(firstLab, secondLab) {
  const [lightness1, a1, b1] = firstLab;
  const [lightness2, a2, b2] = secondLab;
  const chroma1 = Math.hypot(a1, b1);
  const chroma2 = Math.hypot(a2, b2);
  const meanChroma = (chroma1 + chroma2) / 2;
  const meanChroma7 = meanChroma ** 7;
  const g = 0.5 * (1 - Math.sqrt(meanChroma7 / (meanChroma7 + 25 ** 7)));
  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const chroma1Prime = Math.hypot(a1Prime, b1);
  const chroma2Prime = Math.hypot(a2Prime, b2);
  const hue1Prime = (degrees(Math.atan2(b1, a1Prime)) + 360) % 360;
  const hue2Prime = (degrees(Math.atan2(b2, a2Prime)) + 360) % 360;
  const deltaLightness = lightness2 - lightness1;
  const deltaChroma = chroma2Prime - chroma1Prime;
  let hueDifference = 0;

  if (chroma1Prime * chroma2Prime !== 0) {
    hueDifference = hue2Prime - hue1Prime;
    if (hueDifference > 180) hueDifference -= 360;
    else if (hueDifference < -180) hueDifference += 360;
  }

  const deltaHue = 2 * Math.sqrt(chroma1Prime * chroma2Prime) * Math.sin(radians(hueDifference / 2));
  const meanLightnessPrime = (lightness1 + lightness2) / 2;
  const meanChromaPrime = (chroma1Prime + chroma2Prime) / 2;
  let meanHuePrime = hue1Prime + hue2Prime;

  if (chroma1Prime * chroma2Prime !== 0) {
    if (Math.abs(hue1Prime - hue2Prime) <= 180) meanHuePrime /= 2;
    else if (hue1Prime + hue2Prime < 360) meanHuePrime = (hue1Prime + hue2Prime + 360) / 2;
    else meanHuePrime = (hue1Prime + hue2Prime - 360) / 2;
  }

  const t = 1
    - 0.17 * Math.cos(radians(meanHuePrime - 30))
    + 0.24 * Math.cos(radians(2 * meanHuePrime))
    + 0.32 * Math.cos(radians(3 * meanHuePrime + 6))
    - 0.20 * Math.cos(radians(4 * meanHuePrime - 63));
  const deltaTheta = 30 * Math.exp(-(((meanHuePrime - 275) / 25) ** 2));
  const meanChromaPrime7 = meanChromaPrime ** 7;
  const rC = 2 * Math.sqrt(meanChromaPrime7 / (meanChromaPrime7 + 25 ** 7));
  const lightnessOffset = meanLightnessPrime - 50;
  const sL = 1 + (0.015 * lightnessOffset ** 2) / Math.sqrt(20 + lightnessOffset ** 2);
  const sC = 1 + 0.045 * meanChromaPrime;
  const sH = 1 + 0.015 * meanChromaPrime * t;
  const rT = -Math.sin(radians(2 * deltaTheta)) * rC;
  const lightnessTerm = deltaLightness / sL;
  const chromaTerm = deltaChroma / sC;
  const hueTerm = deltaHue / sH;

  return Math.sqrt(lightnessTerm ** 2 + chromaTerm ** 2 + hueTerm ** 2 + rT * chromaTerm * hueTerm);
}

function clientReferenceProfile(reference) {
  const ranges = ['r', 'g', 'b'].map((channel) => normalizedRange(reference?.rgbRange?.[channel]));
  if (ranges.some((range) => !range)) return null;
  const centroidRGB = ranges.map(([minimum, maximum]) => (minimum + maximum) / 2);
  return {
    reference,
    ranges,
    centroidRGB,
    centroidLab: rgbToLab(centroidRGB),
  };
}

function normalizedChromaticDistance(first, second) {
  const totalFirst = first.reduce((sum, channel) => sum + channel, 0);
  const totalSecond = second.reduce((sum, channel) => sum + channel, 0);
  if (totalFirst === 0 || totalSecond === 0) return null;
  const normalizedFirst = first.map((channel) => channel / totalFirst);
  const normalizedSecond = second.map((channel) => channel / totalSecond);
  return Math.hypot(...normalizedFirst.map((channel, index) => channel - normalizedSecond[index]));
}

function matchClientColorByCentroid(measuredRGB, references, { parameter }) {
  if (!Array.isArray(measuredRGB) || measuredRGB.length !== 3
    || measuredRGB.some((channel) => !Number.isFinite(channel))
    || !Array.isArray(references)) {
    return {
      accepted: false,
      reference: null,
      value: null,
      matchState: 'OUTSIDE_REFERENCE_SPACE',
      diagnostics: {
        parameter,
        distanceMetric: 'CIEDE2000',
        accepted: false,
        reason: 'INVALID_MEASUREMENT_OR_REFERENCES',
        candidateDistances: [],
      },
    };
  }

  const profiles = references.map(clientReferenceProfile).filter(Boolean);
  const candidates = profiles.map((profile) => {
    const intervalDistances = measuredRGB.map((value, index) => rangeDistance(value, profile.ranges[index]));
    return {
      reference: profile.reference,
      centroidRGB: profile.centroidRGB,
      ranges: profile.ranges,
      rawRgbIntervalMatch: intervalDistances.every((distance) => distance === 0),
      rgbEuclideanDistance: Math.hypot(...measuredRGB.map((value, index) => value - profile.centroidRGB[index])),
      deltaE00: deltaE00(rgbToLab(measuredRGB), profile.centroidLab),
      normalizedChromaticDistance: normalizedChromaticDistance(measuredRGB, profile.centroidRGB),
    };
  }).sort((left, right) => left.deltaE00 - right.deltaE00);

  const exactMatches = candidates.filter(({ rawRgbIntervalMatch }) => rawRgbIntervalMatch);
  const pairwiseSeparations = [];
  for (let first = 0; first < profiles.length; first += 1) {
    for (let second = first + 1; second < profiles.length; second += 1) {
      pairwiseSeparations.push(deltaE00(profiles[first].centroidLab, profiles[second].centroidLab));
    }
  }
  const minimumReferenceSeparation = pairwiseSeparations.length
    ? Math.min(...pairwiseSeparations)
    : null;
  // Derive both guards from the active references. Keeping each at one third
  // of the closest pairwise centroid gap leaves a reject band between classes.
  const acceptanceThreshold = Number.isFinite(minimumReferenceSeparation)
    ? minimumReferenceSeparation / 3
    : null;
  const minimumRequiredMargin = acceptanceThreshold;
  const best = candidates[0] || null;
  const second = candidates[1] || null;
  const margin = best && second ? second.deltaE00 - best.deltaE00 : null;
  const withinAcceptanceThreshold = Boolean(best
    && Number.isFinite(acceptanceThreshold)
    && best.deltaE00 <= acceptanceThreshold);
  const meetsMinimumMargin = Boolean(Number.isFinite(margin)
    && Number.isFinite(minimumRequiredMargin)
    && margin >= minimumRequiredMargin);
  const acceptedExactly = exactMatches.length === 1;
  const acceptedByDistance = exactMatches.length === 0
    && withinAcceptanceThreshold
    && meetsMinimumMargin;
  const ambiguousExact = exactMatches.length > 1;
  const accepted = acceptedExactly || acceptedByDistance;
  const reason = acceptedExactly
    ? 'EXACT_RGB_RANGE_MATCH'
    : ambiguousExact
      ? 'AMBIGUOUS_RGB_INTERVAL_MATCH'
      : acceptedByDistance
        ? 'ACCEPTED_WITHIN_CIEDE2000_THRESHOLD_AND_MARGIN'
        : !best
          ? 'NO_VALID_REFERENCE_CLASSES'
          : withinAcceptanceThreshold && !meetsMinimumMargin
            ? 'AMBIGUOUS_RUNNER_UP_MARGIN'
            : !withinAcceptanceThreshold && !meetsMinimumMargin
              ? 'OUTSIDE_THRESHOLD_AND_AMBIGUOUS_MARGIN'
              : 'OUTSIDE_CIEDE2000_ACCEPTANCE_THRESHOLD';
  const matchMethod = acceptedExactly ? 'RAW_RGB_INTERVAL' : 'CIEDE2000_CENTROID_DISTANCE';
  const matchedCandidate = accepted ? (acceptedExactly ? exactMatches[0] : best) : null;
  const value = matchedCandidate?.reference?.qualifier === '>'
    ? null
    : matchedCandidate?.reference?.value ?? null;
  const matchState = !accepted
    ? (ambiguousExact || (best && Number.isFinite(acceptanceThreshold)
      && best.deltaE00 <= acceptanceThreshold && !acceptedByDistance) ? 'AMBIGUOUS' : 'OUTSIDE_REFERENCE_SPACE')
    : matchedCandidate.reference.qualifier === '>'
      ? 'ABOVE_1_PPM'
      : acceptedExactly ? 'EXACT_OR_IN_RANGE' : 'DISTANCE_MATCH';
  const candidateDistances = candidates.map((candidate) => ({
    label: candidate.reference.label,
    value: candidate.reference.value,
    deltaE00: candidate.deltaE00,
    rgbEuclideanDistance: candidate.rgbEuclideanDistance,
    normalizedChromaticDistance: candidate.normalizedChromaticDistance,
    rawRgbIntervalMatch: candidate.rawRgbIntervalMatch,
    centroidRGB: candidate.centroidRGB,
  }));
  const diagnostics = {
    parameter,
    distanceMetric: 'CIEDE2000',
    bestReference: best ? { label: best.reference.label, value: best.reference.value } : null,
    secondBestReference: second ? { label: second.reference.label, value: second.reference.value } : null,
    bestDistance: best?.deltaE00 ?? null,
    secondBestDistance: second?.deltaE00 ?? null,
    margin,
    minimumReferenceSeparation,
    acceptanceThreshold,
    minimumRequiredMargin,
    accepted,
    withinAcceptanceThreshold,
    meetsMinimumMargin,
    reason,
    candidateDistances,
  };

  return {
    accepted,
    reference: matchedCandidate?.reference || null,
    value,
    displayValue: matchedCandidate?.reference?.displayValue
      || (matchedCandidate?.reference?.qualifier === '>' ? `>${matchedCandidate.reference.lowerBound} ppm`
        : matchedCandidate ? `${matchedCandidate.reference.value}${parameter === 'nitrite' ? ' ppm' : ''}` : null),
    qualifier: matchedCandidate?.reference?.qualifier ?? null,
    lowerBound: matchedCandidate?.reference?.lowerBound ?? null,
    matchMethod,
    matchState,
    closestReference: best?.reference || null,
    distance: best?.deltaE00 ?? null,
    rgbEuclideanDistance: best?.rgbEuclideanDistance ?? null,
    normalizedChromaticDistance: best?.normalizedChromaticDistance ?? null,
    diagnostics,
    candidates,
  };
}

/**
 * Match only the client-provided pH 1–4 references. The grouped legacy pH
 * labels and pH 5–14 Lab examples are intentionally outside this classifier.
 */
export function matchPHClientColor(measuredRGB, clientRgbRanges) {
  return matchClientColorByCentroid(measuredRGB, clientRgbRanges, { parameter: 'pH' });
}

/** Match discrete client Nitrite classes without interpolation or clamping. */
export function matchNitriteClientColor(measuredRGB, references) {
  return matchClientColorByCentroid(measuredRGB, references, { parameter: 'nitrite' });
}

function normalizedRange(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [first, second] = value;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return [Math.min(first, second), Math.max(first, second)];
}

/**
 * Match a robust pH ROI RGB statistic against client-provided provisional
 * ranges. This is intentionally separate from the CIELAB reference matcher:
 * pH 1–4 are supplied as RGB intervals, while pH 0 has no individual client
 * reference and must never be invented.
 */
export function matchPHClientRgbRange(measuredRGB, clientRgbRanges) {
  if (!Array.isArray(measuredRGB) || measuredRGB.length !== 3
    || measuredRGB.some((channel) => !Number.isFinite(channel))) return null;
  if (!Array.isArray(clientRgbRanges)) return null;

  const candidates = clientRgbRanges.map((reference) => {
    const ranges = ['r', 'g', 'b'].map((channel) => normalizedRange(reference?.rgbRange?.[channel]));
    if (ranges.some((range) => !range)) return null;
    const distances = measuredRGB.map((value, index) => {
      const [minimum, maximum] = ranges[index];
      return value < minimum ? minimum - value : value > maximum ? value - maximum : 0;
    });
    return {
      reference,
      ranges,
      distances,
      maxDistance: Math.max(...distances),
    };
  }).filter(Boolean);

  const exactMatches = candidates.filter(({ maxDistance }) => maxDistance === 0);
  if (exactMatches.length !== 1) return null;
  const best = exactMatches[0];

  return {
    ...best,
    status: 'EXACT_IN_RANGE',
    provisional: true,
    confidence: 1,
    normalizedRanges: best.ranges,
  };
}

export function matchPHReference(measuredLab, references, { maxDeltaE00 = null } = {}) {
  const matches = references.map((reference) => ({
    reference,
    deltaE00: deltaE00(measuredLab, reference.lab),
  })).sort((left, right) => left.deltaE00 - right.deltaE00);
  const best = matches[0] || null;
  if (!best) return null;
  if (Number.isFinite(maxDeltaE00) && best.deltaE00 > maxDeltaE00) return null;
  return {
    ...best,
    reliabilityStatus: Number.isFinite(maxDeltaE00)
      ? 'RELIABLE_WITHIN_PROVISIONAL_THRESHOLD'
      : 'THRESHOLD_NOT_CONFIGURED',
    candidates: matches,
  };
}

function rangeDistance(value, range) {
  if (value < range[0]) return range[0] - value;
  if (value > range[1]) return value - range[1];
  return 0;
}

/**
 * Match a registered Nitrite ROI against the three client-provided direct
 * RGB classes. This is deliberately a discrete classifier: there is no
 * interpolation, extrapolation, or endpoint clamping without validated
 * calibration data.
 */
export function matchNitriteClientRgbRange(measuredRGB, references) {
  const invalid = !Array.isArray(measuredRGB) || measuredRGB.length !== 3
    || measuredRGB.some((channel) => !Number.isFinite(channel))
    || !Array.isArray(references);
  if (invalid) return { matchState: 'OUTSIDE_REFERENCE_SPACE', value: null, candidates: [] };

  const candidates = references.map((reference) => {
    const ranges = ['r', 'g', 'b'].map((channel) => normalizedRange(reference?.rgbRange?.[channel]));
    if (ranges.some((range) => !range)) return null;
    const channelDistances = measuredRGB.map((value, index) => rangeDistance(value, ranges[index]));
    const midpointRGB = ranges.map(([minimum, maximum]) => (minimum + maximum) / 2);
    const distance = Math.hypot(...measuredRGB.map((value, index) => value - midpointRGB[index]));
    return {
      reference,
      ranges,
      midpointRGB,
      channelDistances,
      maxChannelDistance: Math.max(...channelDistances),
      distance,
    };
  }).filter(Boolean).sort((left, right) => left.distance - right.distance);

  const exact = candidates.filter(({ maxChannelDistance }) => maxChannelDistance === 0);
  const base = {
    value: null,
    unit: 'ppm',
    provisional: true,
    source: 'CLIENT_DIRECT_NITRITE_RGB',
    candidates,
    closestReference: candidates[0]?.reference || null,
    distance: candidates[0]?.distance ?? null,
    channelDistances: candidates[0]?.channelDistances || null,
  };
  if (exact.length !== 1) {
    if (exact.length > 1) return { ...base, matchState: 'AMBIGUOUS' };
  } else {
    const match = exact[0];
    if (match.reference.qualifier === '>') {
      return {
        ...base,
        ...match,
        value: null,
        displayValue: match.reference.displayValue || `>${match.reference.lowerBound} ppm`,
        qualifier: match.reference.qualifier,
        lowerBound: match.reference.lowerBound,
        matchState: 'ABOVE_1_PPM',
      };
    }
    return {
      ...base,
      ...match,
      value: match.reference.value,
      displayValue: match.reference.displayValue || `${match.reference.value} ppm`,
      matchState: 'EXACT_OR_IN_RANGE',
    };
  }

  return { ...base, matchState: 'OUTSIDE_REFERENCE_SPACE' };
}
