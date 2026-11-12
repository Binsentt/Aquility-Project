import { ApiError, api, getApiBaseUrl } from './apiClient.js';
import { toScanResult } from './apiMappers.js';
import { matchSampleSite, sampleSiteForClass } from './sampleSites.js';

export async function analyzeWaterTest(imageUri, metadata = {}) {
  if (metadata.manualLocation) {
    const health = await api.getHealth();
    if (health?.features?.manualSampleLocation !== true) {
      throw new ApiError(
        409,
        'This AQUALITY server does not yet support saving manual sample locations. Clear the pin or contact the server administrator before analyzing.',
        'MANUAL_LOCATION_UNSUPPORTED',
      );
    }
  }

  const sampleLocation = metadata.manualLocation || metadata.location;
  const sampleSite = metadata.sampleSite
    || sampleSiteForClass(metadata.sampleClass)
    || matchSampleSite(sampleLocation?.latitude, sampleLocation?.longitude);
  const waterTest = await api.analyzeWater({
    imageUri,
    imageAsset: metadata.imageAsset,
    imageFile: metadata.imageFile,
    uploadDiagnostics: metadata.uploadDiagnostics,
    multipartFetch: metadata.multipartFetch,
    userId: metadata.userId,
    gpsLatitude: metadata.location?.latitude,
    gpsLongitude: metadata.location?.longitude,
    gpsAccuracyMeters: metadata.location?.accuracy,
    gpsCapturedAt: metadata.location?.timestamp ? new Date(metadata.location.timestamp).toISOString() : null,
    manualLatitude: metadata.manualLocation?.latitude,
    manualLongitude: metadata.manualLocation?.longitude,
    barangay: metadata.barangay,
    municipality: metadata.municipality,
    sampleClass: metadata.sampleClass || sampleSite?.classCode,
    sampleCode: metadata.sampleCode,
    sampleNumber: metadata.sampleNumber,
    siteName: sampleSite?.siteName === 'Unknown sampling site' ? null : sampleSite?.siteName,
    sourceType: sampleSite?.sourceType,
    capturedAt: metadata.capturedAt || new Date().toISOString(),
  });

  return toScanResult(waterTest, getApiBaseUrl());
}

export async function analyzeDocument(input = {}) {
  return analyzeWaterTest(input.imageUri || input.image || input.images?.[0], {
    userId: input.userId,
    location: input.location || null,
    manualLocation: input.manualLocation || null,
    barangay: input.barangay,
    municipality: input.municipality,
    sampleClass: input.sampleClass,
    sampleCode: input.sampleCode,
    sampleNumber: input.sampleNumber,
    capturedAt: input.capturedAt,
    imageAsset: input.imageAsset,
    imageFile: input.imageFile,
    uploadDiagnostics: input.uploadDiagnostics,
    multipartFetch: input.multipartFetch,
    sampleSite: input.sampleSite,
  });
}
