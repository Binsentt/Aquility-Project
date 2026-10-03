import { canonicalizeSampleClass } from './sampleSites.js';

export function createMapService({ waterTestModel }) {
  return {
    async listMarkers() {
      const markers = await waterTestModel.listMarkers();
      return markers.map((marker) => ({
        ...marker,
        sampleClass: canonicalizeSampleClass(marker.sampleClass) || marker.sampleClass || null,
      }));
    },
  };
}
