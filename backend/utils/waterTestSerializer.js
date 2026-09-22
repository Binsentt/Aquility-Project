function formatMeasurement(value, unit, status) {
  return { value: Number(value), unit, status };
}

export function serializeWaterTest(record, authTokenService = null) {
  const location = record.latitude == null || record.longitude == null
    ? null
    : { latitude: Number(record.latitude), longitude: Number(record.longitude) };
  const pH = Number(record.estimatedPH);
  const nitrate = formatMeasurement(record.estimatedNitrate, 'mg/L', record.nitrateStatus);

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
    phStatus: record.phStatus,
    nitrate,
    overallStatus: record.overallStatus,
    status: record.overallStatus,
    remarks: record.remarks,
    summary: record.remarks,
    gps: location,
    location,
    barangay: record.barangay,
    municipality: record.municipality,
    capturedAt: record.capturedAt,
    analyzedAt: record.createdAt,
    createdAt: record.createdAt,
    resultData: {
      pH: pH.toFixed(2),
      Nitrate: `${nitrate.value.toFixed(2)} mg/L`,
      'Overall Status': record.overallStatus,
    },
  };
}
