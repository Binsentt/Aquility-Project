import { basename } from 'node:path';
import { createColorAnalysisEngine } from './colorAnalysisEngine.js';

function unavailableRow(image, error) {
  const registrationFailure = error?.code === 'STRIP_REGISTRATION_FAILED';
  return {
    image,
    registrationStatus: registrationFailure ? 'STRIP_REGISTRATION_FAILED' : 'ANALYSIS_UNAVAILABLE',
    registrationDiagnostic: registrationFailure ? error.registrationFailureCode || null : null,
    pHRgb: null,
    pHNearestReference: null,
    pHDistance: null,
    pHSecondNearestReference: null,
    pHSecondDistance: null,
    pHMargin: null,
    pHMatchAccepted: false,
    pHMatchReason: null,
    pHMatchDiagnostics: null,
    pHAccepted: 'UNAVAILABLE',
    pHDiagnostic: registrationFailure ? 'Registration failed; no pH ROI was measured.' : 'Production analysis was unavailable.',
    nitriteRgb: null,
    nitriteNearestReference: null,
    nitriteDistance: null,
    nitriteSecondNearestReference: null,
    nitriteSecondDistance: null,
    nitriteMargin: null,
    nitriteMatchAccepted: false,
    nitriteMatchReason: null,
    nitriteMatchDiagnostics: null,
    nitriteAccepted: 'UNAVAILABLE',
    nitriteDiagnostic: registrationFailure ? 'Registration failed; no Nitrite ROI was measured.' : 'Production analysis was unavailable.',
  };
}

/**
 * Read-only QA view over the production image registration and analysis path.
 * It reports diagnostics from the existing engine and never writes calibration,
 * database, or image data. Candidate CSV files are intentionally not read.
 */
export async function generateCalibrationQaReport(imagePaths, {
  engine = createColorAnalysisEngine(),
} = {}) {
  if (!Array.isArray(imagePaths)) throw new TypeError('imagePaths must be an array.');

  const rows = [];
  for (const imagePath of imagePaths) {
    const image = imagePath ? basename(String(imagePath)) : '(missing image path)';
    if (!imagePath) {
      rows.push(unavailableRow(image, null));
      continue;
    }

    try {
      let productionMatchDiagnostics = null;
      const result = await engine.analyze({
        imagePath,
        debugLogger(stage, details) {
          if (stage === 'parameter-match-diagnostics') productionMatchDiagnostics = details;
        },
      });
      const pHMatch = productionMatchDiagnostics?.pH || null;
      const nitriteMatch = productionMatchDiagnostics?.nitrite || null;
      const pHNearest = pHMatch?.bestReference
        ? { ...pHMatch.bestReference, source: 'CIEDE2000 client RGB centroid' }
        : null;
      const pHDistance = Number.isFinite(pHMatch?.bestDistance)
        ? { value: pHMatch.bestDistance, metric: 'CIEDE2000 ΔE00', diagnosticOnly: true }
        : null;
      const registrationStatus = result.registration?.status || 'REGISTRATION_STATUS_UNAVAILABLE';
      const registered = registrationStatus === 'REGISTERED';

      rows.push({
        image,
        registrationStatus,
        registrationDiagnostic: null,
        pHRgb: result.pH?.measuredRGB || null,
        pHNearestReference: pHNearest,
        pHDistance,
        pHSecondNearestReference: pHMatch?.secondBestReference || null,
        pHSecondDistance: Number.isFinite(pHMatch?.secondBestDistance)
          ? { value: pHMatch.secondBestDistance, metric: 'CIEDE2000 ΔE00', diagnosticOnly: true }
          : null,
        pHMargin: pHMatch?.margin ?? null,
        pHMatchAccepted: pHMatch?.accepted ?? false,
        pHMatchReason: pHMatch?.reason || null,
        pHMatchDiagnostics: pHMatch,
        pHAccepted: registered && result.pH?.value != null ? 'ACCEPTED' : 'UNAVAILABLE',
        pHDiagnostic: result.pH?.reliabilityStatus || result.pH?.status || null,
        nitriteRgb: result.nitrite?.measuredRGB || null,
        nitriteNearestReference: nitriteMatch?.bestReference || null,
        nitriteDistance: Number.isFinite(nitriteMatch?.bestDistance)
          ? {
            value: nitriteMatch.bestDistance,
            metric: 'CIEDE2000 ΔE00',
            diagnosticOnly: true,
          }
          : null,
        nitriteSecondNearestReference: nitriteMatch?.secondBestReference || null,
        nitriteSecondDistance: Number.isFinite(nitriteMatch?.secondBestDistance)
          ? { value: nitriteMatch.secondBestDistance, metric: 'CIEDE2000 ΔE00', diagnosticOnly: true }
          : null,
        nitriteMargin: nitriteMatch?.margin ?? null,
        nitriteMatchAccepted: nitriteMatch?.accepted ?? false,
        nitriteMatchReason: nitriteMatch?.reason || null,
        nitriteMatchDiagnostics: nitriteMatch,
        nitriteAccepted: registered && result.nitrite?.quantitativeAvailable ? 'ACCEPTED' : 'UNAVAILABLE',
        nitriteDiagnostic: result.nitrite?.matchState || result.nitrite?.status || null,
      });
    } catch (error) {
      rows.push(unavailableRow(image, error));
    }
  }
  return rows;
}
