import { canonicalizeSampleClass } from './sampleSites.js';

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function createMapService({ waterTestModel }) {
  return {
    async listMarkers() {
      const markers = await waterTestModel.listMarkers();
      if (!Array.isArray(markers)) return [];

      return markers
        .filter((marker) => marker && typeof marker === 'object' && !Array.isArray(marker))
        .map((marker) => {
          const nitriteStatus = nullableText(marker.nitriteStatus);
          return {
            id: marker.id,
            latitude: nullableNumber(marker.latitude),
            longitude: nullableNumber(marker.longitude),
            overallStatus: nullableText(marker.overallStatus) || 'NOT CLASSIFIED',
            capturedAt: marker.capturedAt || null,
            barangay: nullableText(marker.barangay),
            municipality: nullableText(marker.municipality),
            sampleClass: canonicalizeSampleClass(marker.sampleClass) || nullableText(marker.sampleClass),
            siteName: nullableText(marker.siteName),
            sourceType: nullableText(marker.sourceType),
            pH: nullableNumber(marker.pH),
            nitriteDisplay: nullableText(marker.nitriteDisplay) || 'Unavailable',
            ...(nitriteStatus ? { nitriteStatus } : {}),
          };
        });
    },
  };
}
