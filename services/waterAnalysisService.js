import { api, getApiBaseUrl } from './apiClient';
import { toScanResult } from './apiMappers';
import { matchSampleSite, sampleSiteForClass } from './sampleSites';

export async function analyzeWaterTest(imageUri, metadata = {}) {
  const sampleSite = metadata.sampleSite
    || sampleSiteForClass(metadata.sampleClass)
    || matchSampleSite(metadata.location?.latitude, metadata.location?.longitude);
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
    gpsCapturedAt: metadata.location?.timestamp ? new Date(metadata.location.timestamp).toISOString() : metadata.capturedAt,
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
