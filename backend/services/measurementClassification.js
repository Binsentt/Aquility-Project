const NOT_CLASSIFIED = 'Not classified';

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

export const MEASUREMENT_STATUS = Object.freeze({
  NOT_CLASSIFIED,
  SCIENTIFIC_PENDING: 'Pending laboratory validation',
});
