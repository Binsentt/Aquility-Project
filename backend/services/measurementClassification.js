const NOT_CLASSIFIED = 'Not classified';

export const NITRITE_STATUS_THRESHOLDS = Object.freeze({
  safeUpperExclusive: 0.5,
  dangerousLowerInclusive: 1.0,
});

function validRule(rule) {
  return rule && typeof rule === 'object'
    && (rule.min != null || rule.max != null)
    && [rule.min, rule.max].filter((bound) => bound != null).every((bound) => Number.isFinite(Number(bound)));
}

function withinRange(value, rule) {
  if (!Number.isFinite(Number(value)) || !validRule(rule)) return false;
  const numeric = Number(value);
  if (rule.min != null && numeric < Number(rule.min)) return false;
  if (rule.max != null && numeric > Number(rule.max)) return false;
  return true;
}

export function classifyMeasurements({ pH, nitrite, thresholds = null } = {}) {
  const pHRule = thresholds?.pH;
  const nitriteRule = thresholds?.nitrite;
  if (!validRule(pHRule) || !validRule(nitriteRule)
    || !Number.isFinite(Number(pH)) || !Number.isFinite(Number(nitrite))) {
    return {
      status: NOT_CLASSIFIED,
      reason: 'NITRITE / OVERALL CLASSIFICATION RULE REQUIRED',
    };
  }

  const pHWithin = withinRange(pH, pHRule);
  const nitriteWithin = withinRange(nitrite, nitriteRule);
  return {
    status: pHWithin && nitriteWithin ? 'Within configured limits' : 'Outside configured limits',
    reason: null,
  };
}

/** Apply the client-approved Nitrite status limits to an accepted measurement. */
export function classifyNitriteStatus(measurement) {
  const result = measurement && typeof measurement === 'object'
    ? measurement
    : { value: measurement };
  const rawValue = result.value;
  const value = typeof rawValue === 'string' && rawValue.trim() !== ''
    ? Number(rawValue)
    : rawValue;

  if (Number.isFinite(value) && value >= 0) {
    if (value < NITRITE_STATUS_THRESHOLDS.safeUpperExclusive) return 'Safe';
    if (value < NITRITE_STATUS_THRESHOLDS.dangerousLowerInclusive) return 'Warning';
    return 'Dangerous';
  }

  const lowerBound = typeof result.lowerBound === 'string' && result.lowerBound.trim() !== ''
    ? Number(result.lowerBound)
    : result.lowerBound;
  if (value == null && result.qualifier === '>'
    && Number.isFinite(lowerBound)
    && lowerBound >= NITRITE_STATUS_THRESHOLDS.dangerousLowerInclusive) {
    return 'Dangerous';
  }

  return null;
}

export const MEASUREMENT_STATUS = Object.freeze({
  NOT_CLASSIFIED,
  SCIENTIFIC_PENDING: 'Pending laboratory validation',
});
