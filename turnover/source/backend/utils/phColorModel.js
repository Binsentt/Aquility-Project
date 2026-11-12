import { rgbToLab } from './colorAnalysis.js';

function rejected(status, lab = null) {
  return {
    accepted: false,
    value: null,
    rawValue: null,
    clamped: false,
    status,
    lab,
    modelVersion: null,
  };
}

function quadraticLabFeatures([lightness, a, b]) {
  return [
    lightness,
    a,
    b,
    lightness ** 2,
    lightness * a,
    lightness * b,
    a ** 2,
    a * b,
    b ** 2,
  ];
}

export function estimatePHFromColor(measuredRGB, model) {
  if (!Array.isArray(measuredRGB) || measuredRGB.length !== 3
    || measuredRGB.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
    return rejected('INVALID_RGB');
  }

  const configured = model && Array.isArray(model.featureMeans)
    && Array.isArray(model.featureScales)
    && Array.isArray(model.coefficients)
    && model.featureMeans.length === 9
    && model.featureScales.length === 9
    && model.coefficients.length === 9
    && model.featureMeans.every(Number.isFinite)
    && model.featureScales.every((scale) => Number.isFinite(scale) && scale > 0)
    && model.coefficients.every(Number.isFinite)
    && Number.isFinite(model.intercept)
    && Number.isFinite(model.supportedPH?.minimum)
    && Number.isFinite(model.supportedPH?.maximum)
    && Array.isArray(model.colorDomain?.labMin)
    && Array.isArray(model.colorDomain?.labMax)
    && model.colorDomain.labMin.length === 3
    && model.colorDomain.labMax.length === 3;
  if (!configured) return rejected('MODEL_UNAVAILABLE');

  const lab = rgbToLab(measuredRGB);
  if (lab.some((value, index) => !Number.isFinite(value)
    || value < model.colorDomain.labMin[index]
    || value > model.colorDomain.labMax[index])) {
    return { ...rejected('OUTSIDE_CALIBRATED_COLOR_DOMAIN', lab), modelVersion: model.version || null };
  }

  const features = quadraticLabFeatures(lab);
  const standardized = features.map((value, index) => (value - model.featureMeans[index]) / model.featureScales[index]);
  const rawValue = model.intercept + standardized.reduce((sum, value, index) => sum + value * model.coefficients[index], 0);
  if (!Number.isFinite(rawValue)) return { ...rejected('INVALID_MODEL_OUTPUT', lab), modelVersion: model.version || null };

  const value = Math.max(model.supportedPH.minimum, Math.min(model.supportedPH.maximum, rawValue));
  return {
    accepted: true,
    value,
    rawValue,
    clamped: value !== rawValue,
    status: 'ESTIMATED_FROM_COLOR',
    lab,
    modelVersion: model.version || null,
    method: model.method || 'standardized-quadratic-lab-ridge',
  };
}
