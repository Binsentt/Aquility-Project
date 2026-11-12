function normalizeCoordinate(value) {
  if (!value || typeof value !== 'object') return null;
  const isCoordinateScalar = (coordinate) => typeof coordinate === 'number'
    || (typeof coordinate === 'string' && coordinate.trim() !== '');
  if (!isCoordinateScalar(value.latitude) || !isCoordinateScalar(value.longitude)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

function coordinateFromPressEvent(event) {
  const payload = event?.nativeEvent || event || {};
  const value = payload.lngLat || payload.geometry?.coordinates || payload.coordinate || payload.coordinates || payload.latlng || payload.location;
  if (Array.isArray(value) && value.length >= 2) {
    return normalizeCoordinate({ latitude: value[1], longitude: value[0] });
  }
  return normalizeCoordinate(value);
}

export function createManualLocationDraft(cameraCenter) {
  return {
    cameraCenter: normalizeCoordinate(cameraCenter),
    coordinate: null,
  };
}

export function selectManualLocation(draft, event) {
  const coordinate = coordinateFromPressEvent(event);
  return coordinate ? { ...draft, coordinate } : draft;
}

export function confirmManualLocation(draft) {
  return normalizeCoordinate(draft?.coordinate);
}
