import { api, getApiBaseUrl } from './apiClient';
import { toScanResult } from './apiMappers';

export async function analyzeWaterTest(imageUri, metadata = {}) {
  const waterTest = await api.analyzeWater({
    imageUri,
    userId: metadata.userId,
    gpsLatitude: metadata.location?.latitude,
    gpsLongitude: metadata.location?.longitude,
    barangay: metadata.barangay,
    municipality: metadata.municipality,
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
    capturedAt: input.capturedAt,
  });
}
