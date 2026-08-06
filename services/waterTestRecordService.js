import { api, getApiBaseUrl } from './apiClient';
import { toScanResult } from './apiMappers';

export async function loadBackendWaterTest(id) {
  if (!id) {
    throw new Error('This report is not linked to a saved AQUILITY water-test record.');
  }
  const waterTest = await api.getWaterTest(id);
  return toScanResult(waterTest, getApiBaseUrl());
}
