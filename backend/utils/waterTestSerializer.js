function formatMeasurement(value, unit, status) {
  return { value: value == null ? null : Number(value), unit, status };
}

function comparison(appValue, labValue) {
  if (appValue == null || labValue == null || !Number.isFinite(Number(appValue)) || !Number.isFinite(Number(labValue))) {
    return { labValue: null, absoluteDifference: null, percentDifference: null };
  }
  const app = Number(appValue);
  const lab = Number(labValue);
  return {
    labValue: lab,
    absoluteDifference: Math.abs(app - lab),
    percentDifference: lab === 0 ? null : (Math.abs(app - lab) / Math.abs(lab)) * 100,
  };
}

export function serializeWaterTest(record, authTokenService = null) {
  const location = record.latitude == null || record.longitude == null
    ? null
    : { latitude: Number(record.latitude), longitude: Number(record.longitude) };
  const pHResult = record.analysisData?.pH || null;
  const pH = pHResult?.value ?? (record.estimatedPH == null ? null : Number(record.estimatedPH));
  const nitrite = record.analysisData?.nitrite
    ? { ...record.analysisData.nitrite, status: record.nitriteStatus }
    : formatMeasurement(record.estimatedNitrite, 'ppm', record.nitriteStatus);
  const isLegacyNitrateRecord = !record.analysisData && record.estimatedNitrite == null;
  const overallStatus = isLegacyNitrateRecord || record.overallStatus === 'Unvalidated'
    ? 'NOT CLASSIFIED'
    : (record.overallStatus || 'NOT CLASSIFIED');
  const remarks = isLegacyNitrateRecord
    ? 'This historical record contains a Nitrate result and cannot be interpreted as Nitrite. Reanalyze the image using the current Nitrite calibration.'
    : (record.remarks || 'No approved classification rule is configured.');

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
    phStatus: record.phStatus,
    nitrite,
    overallStatus,
    status: overallStatus,
    remarks,
    summary: remarks,
    scanStatus: 'Completed',
    measuredParametersStatus: record.measuredParametersStatus || 'Not classified',
    scientificValidationStatus: record.scientificValidationStatus || 'Pending laboratory validation',
    roiLocalizationStatus: record.analysisData?.roiLocalizationStatus || 'STRIP REGISTRATION REQUIRED',
    gps: location,
    location,
    actualLatitude: location?.latitude ?? null,
    actualLongitude: location?.longitude ?? null,
    sampleClass: record.sampleClass || null,
    sampleCode: record.sampleCode || null,
    sampleNumber: record.sampleNumber == null ? null : Number(record.sampleNumber),
    siteName: record.siteName || 'Unknown sampling site',
    sourceType: record.sourceType || null,
    sampleSite: {
      classCode: record.sampleClass || null,
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
      pH: typeof pH === 'number' ? pH.toFixed(2) : pH || 'Unavailable',
      Nitrite: typeof nitrite.displayValue === 'string' && nitrite.displayValue.trim()
        ? nitrite.displayValue
        : (nitrite.value == null ? 'Unavailable' : `${Number(nitrite.value).toFixed(2)} ppm`),
      'Measured Parameters Status': record.measuredParametersStatus || 'Not classified',
      'Scientific Validation': record.scientificValidationStatus || 'Pending laboratory validation',
    },
    labComparison: {
      pH: comparison(pH, record.labPH),
      Nitrite: comparison(nitrite.value, record.labNitrite),
    },
  };
}
