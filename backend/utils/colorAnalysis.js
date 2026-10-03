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
      const offset = (y * imageWidth + x) * 3;
      const channels = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
      red.push(channels[0]);
      green.push(channels[1]);
      blue.push(channels[2]);
      luminance.push(0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]);
    }
  }

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
    roiPixels: { left, top, width: right - left, height: bottom - top },
    statistic: 'per-channel-median-with-luminance-outlier-filter',
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
export function matchPHClientRgbRange(measuredRGB, clientRgbRanges, {
  tolerance = 8,
  ambiguityMargin = 0.2,
} = {}) {
  if (!Array.isArray(measuredRGB) || measuredRGB.length !== 3
    || measuredRGB.some((channel) => !Number.isFinite(channel))) return null;
  if (!Array.isArray(clientRgbRanges) || !Number.isFinite(tolerance) || tolerance <= 0) return null;

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
      score: distances.reduce((sum, distance) => sum + distance / tolerance, 0),
    };
  }).filter(Boolean).sort((left, right) => left.score - right.score);

  const best = candidates[0] || null;
  if (!best || best.maxDistance > tolerance) return null;
  const second = candidates[1];
  if (second && Math.abs(second.score - best.score) < ambiguityMargin) return null;

  return {
    ...best,
    status: best.maxDistance === 0 ? 'EXACT_IN_RANGE' : 'NEAR_RANGE',
    provisional: true,
    confidence: Math.max(0, 1 - (best.score / 3)),
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
export function matchNitriteClientRgbRange(measuredRGB, references, {
  nearChannelTolerance = 8,
  nearDistance = 18,
  ambiguityDistance = 2,
} = {}) {
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

  const near = candidates.filter(({ maxChannelDistance, distance }) => (
    maxChannelDistance <= nearChannelTolerance && distance <= nearDistance
  ));
  if (!near.length) return { ...base, matchState: 'OUTSIDE_REFERENCE_SPACE' };
  if (near.length > 1 && near[1].distance - near[0].distance <= ambiguityDistance) {
    return { ...base, matchState: 'AMBIGUOUS', candidates: near };
  }
  const match = near[0];
  return {
    ...base,
    ...match,
    value: match.reference.value,
    displayValue: match.reference.displayValue || `${match.reference.value} ppm`,
    matchState: 'NEAR_REFERENCE',
  };
}
