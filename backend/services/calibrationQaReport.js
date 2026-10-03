import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createColorAnalysisEngine } from './colorAnalysisEngine.js';
import { matchPHClientRgbRange, matchPHReference } from '../utils/colorAnalysis.js';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

async function readActiveCalibration() {
  return JSON.parse(await readFile(join(databaseDir, 'colorAnalysisCalibration.json'), 'utf8'));
}

function unavailableRow(image, error) {
  const registrationFailure = error?.code === 'STRIP_REGISTRATION_FAILED';
  return {
    image,
    registrationStatus: registrationFailure ? 'STRIP_REGISTRATION_FAILED' : 'ANALYSIS_UNAVAILABLE',
    registrationDiagnostic: registrationFailure ? error.registrationFailureCode || null : null,
    pHRgb: null,
    pHNearestReference: null,
    pHDistance: null,
    pHAccepted: 'UNAVAILABLE',
    pHDiagnostic: registrationFailure ? 'Registration failed; no pH ROI was measured.' : 'Production analysis was unavailable.',
    nitriteRgb: null,
    nitriteNearestReference: null,
    nitriteDistance: null,
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
  calibration = null,
  readCalibration = readActiveCalibration,
} = {}) {
  if (!Array.isArray(imagePaths)) throw new TypeError('imagePaths must be an array.');
  const activeCalibration = calibration || await readCalibration();

  const rows = [];
  for (const imagePath of imagePaths) {
    const image = imagePath ? basename(String(imagePath)) : '(missing image path)';
    if (!imagePath) {
      rows.push(unavailableRow(image, null));
      continue;
    }

    try {
      const result = await engine.analyze({ imagePath });
      const pHClientMatch = matchPHClientRgbRange(
        result.pH?.measuredRGB,
        activeCalibration.pH?.clientRgbRanges,
        {
          tolerance: activeCalibration.pH?.clientRgbTolerance ?? 8,
          ambiguityMargin: activeCalibration.pH?.clientRgbAmbiguityMargin ?? 0.2,
        },
      );
      const pHLabMatch = matchPHReference(result.pH?.measuredLab, activeCalibration.pH?.references || []);
      const pHNearest = pHClientMatch
        ? { label: pHClientMatch.reference.label, source: 'client RGB interval' }
        : pHLabMatch
          ? { label: pHLabMatch.reference.label, source: 'CIEDE2000 Lab reference' }
          : null;
      const pHDistance = pHClientMatch
        ? {
          value: pHClientMatch.maxDistance,
          metric: 'maximum per-channel distance to client RGB interval',
          diagnosticOnly: true,
        }
        : Number.isFinite(result.pH?.deltaE00)
          ? { value: result.pH.deltaE00, metric: 'CIEDE2000 ΔE00', diagnosticOnly: true }
          : pHLabMatch
            ? { value: pHLabMatch.deltaE00, metric: 'CIEDE2000 ΔE00', diagnosticOnly: true }
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
        pHAccepted: registered && result.pH?.value != null ? 'ACCEPTED' : 'UNAVAILABLE',
        pHDiagnostic: result.pH?.reliabilityStatus || result.pH?.status || null,
        nitriteRgb: result.nitrite?.measuredRGB || null,
        nitriteNearestReference: result.nitrite?.closestReference?.label
          ? { label: result.nitrite.closestReference.label }
          : result.nitrite?.matchedReference?.label ? { label: result.nitrite.matchedReference.label } : null,
        nitriteDistance: Number.isFinite(result.nitrite?.distance)
          ? {
            value: result.nitrite.distance,
            metric: 'RGB Euclidean distance to interval midpoint',
            diagnosticOnly: true,
          }
          : null,
        nitriteAccepted: registered && result.nitrite?.quantitativeAvailable ? 'ACCEPTED' : 'UNAVAILABLE',
        nitriteDiagnostic: result.nitrite?.matchState || result.nitrite?.status || null,
      });
    } catch (error) {
      rows.push(unavailableRow(image, error));
    }
  }
  return rows;
}
