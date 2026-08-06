export function createMapService({ waterTestModel }) {
  return {
    async listMarkers() {
      return waterTestModel.listMarkers();
    },
  };
}
