function formatMeasurement(value, unit, status) {
  return { value: value == null ? null : Number(value), unit, status };
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
  const overallStatus = isLegacyNitrateRecord ? 'Unvalidated' : record.overallStatus;
  const remarks = isLegacyNitrateRecord
    ? 'This historical record contains a Nitrate result and cannot be interpreted as Nitrite. Reanalyze the image using the current Nitrite calibration.'
    : record.remarks;

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
    gps: location,
    location,
    barangay: record.barangay,
    municipality: record.municipality,
    capturedAt: record.capturedAt,
    analyzedAt: record.createdAt,
    createdAt: record.createdAt,
    resultData: {
      pH: typeof pH === 'number' ? pH.toFixed(2) : pH || 'Unavailable',
      Nitrite: nitrite.value == null ? 'Unavailable' : `${Number(nitrite.value).toFixed(2)} ppm`,
      'Overall Status': overallStatus,
    },
  };
}
