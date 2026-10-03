import { canonicalizeSampleClass, canonicalizeSampleCode } from '../services/sampleSites.js';

function formatMeasurement(value, unit, status) {
  return { value: value == null ? null : Number(value), unit, status };
}

function displayMeasurement(value, result, format) {
  if (typeof value === 'number') return format(value);
  if (typeof result?.displayValue === 'string' && result.displayValue.trim()) return result.displayValue;
  if (Array.isArray(result?.measuredRGB) && result.measuredRGB.length === 3
    && result.measuredRGB.every((channel) => Number.isFinite(Number(channel)))) return 'No reference match';
  return 'Unavailable';
}

function clientRemarks(record, pHResult, nitrite) {
  const remarks = typeof record.remarks === 'string' ? record.remarks : '';
  if (!/client-provided provisional references|provisional client reference colors|analytically validated method|HSV H\/S\/V|scientific (?:validation|comparison)|laboratory (?:comparison|validation)|certified water-safety/i.test(remarks)) {
    return remarks || 'No approved classification rule is configured.';
  }

  const reasons = [];
  if (pHResult?.value == null && Array.isArray(pHResult?.measuredRGB)) {
    const reason = pHResult.reliabilityStatus === 'THRESHOLD_NOT_CONFIGURED'
      ? 'the pH match-confidence threshold is not configured'
      : 'no reliable pH reference match was found';
    reasons.push(`pH ROI RGB ${pHResult.measuredRGB.join(', ')}: ${reason}.`);
  }
  if (nitrite?.value == null && !nitrite?.displayValue && Array.isArray(nitrite?.measuredRGB)) {
    reasons.push(`Nitrite ROI RGB ${nitrite.measuredRGB.join(', ')}: no configured reference match was found.`);
  }
  return ['Separate µPAD sensing areas were localized. Results are shown only when a configured reference matches.', ...reasons].join(' ');
}

export function serializeWaterTest(record, authTokenService = null) {
  const location = record.latitude == null || record.longitude == null
    ? null
    : { latitude: Number(record.latitude), longitude: Number(record.longitude) };
  const storedPHResult = record.analysisData?.pH || null;
  const groupedPHRange = typeof storedPHResult?.value === 'string'
    && /^\s*\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*$/.test(storedPHResult.value);
  const pHResult = groupedPHRange
    ? {
      ...storedPHResult,
      value: null,
      exactValue: null,
      displayValue: null,
      status: 'PH_MEASUREMENT_UNRELIABLE',
      reliabilityStatus: 'GROUPED_RANGE_NOT_A_MEASURED_VALUE',
      matchedReference: null,
    }
    : storedPHResult;
  const pH = groupedPHRange
    ? null
    : pHResult?.value ?? (record.estimatedPH == null ? null : Number(record.estimatedPH));
  const nitrite = record.analysisData?.nitrite
    ? { ...record.analysisData.nitrite, status: record.nitriteStatus }
    : formatMeasurement(record.estimatedNitrite, 'ppm', record.nitriteStatus);
  const isLegacyNitrateRecord = !record.analysisData && record.estimatedNitrite == null;
  const overallStatus = isLegacyNitrateRecord || record.overallStatus === 'Unvalidated'
    ? 'NOT CLASSIFIED'
    : (record.overallStatus || 'NOT CLASSIFIED');
  const remarks = isLegacyNitrateRecord
    ? 'This historical record contains an older parameter result and cannot be interpreted using the current Nitrite references.'
    : clientRemarks(record, pHResult, nitrite);
  const sampleClass = canonicalizeSampleClass(record.sampleClass) || record.sampleClass || null;
  const sampleCode = canonicalizeSampleCode(record.sampleCode) || record.sampleCode || null;

  const imageToken = authTokenService?.issueMediaToken?.({ waterTestId: record.id, userId: record.userId });
  const imageUri = imageToken ? `/api/water-tests/${record.id}/image?token=${encodeURIComponent(imageToken)}` : record.imagePath;

  return {
    analysisId: record.id,
    id: record.id,
    userId: record.userId,
    user: record.user || null,
    title: 'Water Test',
    imagePath: imageUri,
    imageUri,
    pH,
    pHResult,
    phStatus: groupedPHRange ? 'PH_MEASUREMENT_UNRELIABLE' : record.phStatus,
    nitrite,
    overallStatus,
    status: overallStatus,
    remarks,
    summary: remarks,
    scanStatus: 'Completed',
    measuredParametersStatus: record.measuredParametersStatus || 'Not classified',
    roiLocalizationStatus: record.analysisData?.roiLocalizationStatus || 'STRIP REGISTRATION REQUIRED',
    gps: location,
    location,
    actualLatitude: location?.latitude ?? null,
    actualLongitude: location?.longitude ?? null,
    sampleClass,
    sampleCode,
    sampleNumber: record.sampleNumber == null ? null : Number(record.sampleNumber),
    siteName: record.siteName || 'Unknown sampling site',
    sourceType: record.sourceType || null,
    sampleSite: {
      classCode: sampleClass,
      siteName: record.siteName || 'Unknown sampling site',
      sourceType: record.sourceType || null,
    },
    barangay: record.barangay,
    municipality: record.municipality,
    capturedAt: record.capturedAt,
    gpsAccuracyMeters: record.gpsAccuracyMeters == null ? null : Number(record.gpsAccuracyMeters),
    gpsCapturedAt: record.gpsCapturedAt || null,
    canonicalLocation: record.canonicalLatitude == null || record.canonicalLongitude == null
      ? null
      : { latitude: Number(record.canonicalLatitude), longitude: Number(record.canonicalLongitude) },
    analyzedAt: record.createdAt,
    createdAt: record.createdAt,
    resultData: {
      pH: displayMeasurement(pH, pHResult, (value) => value.toFixed(2)),
      Nitrite: displayMeasurement(nitrite.value, nitrite, (value) => `${value.toFixed(2)} ppm`),
      'Measured Parameters Status': record.measuredParametersStatus || 'Not classified',
    },
  };
}
