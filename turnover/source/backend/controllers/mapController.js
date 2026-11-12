export function createMapController({ mapService }) {
  return {
    async list(req, res, next) {
      try {
        res.json({ items: await mapService.listMarkers() });
      } catch (error) {
        next(error);
      }
    },
  };
}
