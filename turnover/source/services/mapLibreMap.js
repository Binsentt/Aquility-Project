import { filterValidMapMarkers, normalizeMapCoordinate, pHCategoryFor, safeMapFeed } from './apiMappers.js';

export const OPENFREEMAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function mapLoadReducer(state, event) {
  if (event === 'retry') return 'loading';
  if (event === 'failed' || (event === 'timeout' && state !== 'ready')) return 'failed';
  if (event === 'ready') return 'ready';
  return state;
}

function safeNormalizeMapCoordinate(latitude, longitude) {
  const isNumericScalar = (value) => typeof value === 'number'
    || (typeof value === 'string' && value.trim() !== '');
  if (!isNumericScalar(latitude) || !isNumericScalar(longitude)) return null;

  try {
    return normalizeMapCoordinate(latitude, longitude);
  } catch {
    return null;
  }
}

export function toMapLibreLngLat(coordinate) {
  if (!coordinate || typeof coordinate !== 'object') return null;
  const normalized = safeNormalizeMapCoordinate(coordinate.latitude, coordinate.longitude);
  return normalized ? [normalized.longitude, normalized.latitude] : null;
}

const PUBLIC_MARKER_FIELDS = [
  'title',
  'description',
  'barangay',
  'municipality',
  'overallStatus',
  'pinColor',
  'createdAt',
  'sampleClass',
  'siteName',
  'sourceType',
  'nitriteDisplay',
  'nitriteStatus',
];

export function buildMapLibreMarkers(markers) {
  if (!Array.isArray(markers)) return [];
  const seenIds = new Set();

  return markers.flatMap((marker) => {
    const validIdType = typeof marker?.id === 'string'
      || (typeof marker?.id === 'number' && Number.isFinite(marker.id));
    if (!marker || typeof marker !== 'object' || !validIdType) return [];
    const id = String(marker.id).trim();
    const coordinate = safeNormalizeMapCoordinate(marker.coordinate?.latitude, marker.coordinate?.longitude);
    if (!id || !coordinate || seenIds.has(id)) return [];
    seenIds.add(id);

    const model = {
      id,
      coordinate,
      lngLat: [coordinate.longitude, coordinate.latitude],
    };

    const rawPH = marker.pH;
    const pH = rawPH == null || (typeof rawPH === 'string' && rawPH.trim() === '')
      || (typeof rawPH !== 'number' && typeof rawPH !== 'string')
      ? null
      : Number(rawPH);
    model.pH = Number.isFinite(pH) ? pH : null;
    model.pHCategory = pHCategoryFor(model.pH);
    model.nitriteDisplay = typeof marker.nitriteDisplay === 'string' && marker.nitriteDisplay.trim()
      ? marker.nitriteDisplay.trim()
      : 'Unavailable';

    for (const field of PUBLIC_MARKER_FIELDS) {
      const value = marker[field];
      if (typeof value === 'string' || value === null) model[field] = value;
    }

    return [model];
  });
}

export function mapMarkersFromHistory(scanHistory) {
  const history = Array.isArray(scanHistory) ? scanHistory : [];
  return filterValidMapMarkers(history.map((scan) => ({
    id: scan?.id,
    latitude: scan?.location?.latitude,
    longitude: scan?.location?.longitude,
    overallStatus: scan?.overallStatus || scan?.status,
    capturedAt: scan?.capturedAt || scan?.createdAt,
    barangay: scan?.barangay || scan?.user?.barangay,
    municipality: scan?.municipality || scan?.user?.municipality,
    sampleClass: scan?.sampleClass,
    siteName: scan?.siteName,
    sourceType: scan?.sourceType,
    pH: scan?.pH,
    nitriteDisplay: scan?.nitrite?.displayValue || scan?.resultData?.Nitrite || null,
    nitriteStatus: scan?.nitriteClassificationStatus || scan?.nitrite?.classificationStatus || scan?.resultData?.['Nitrite Status'] || null,
    nitrite: scan?.nitrite,
  })));
}

export async function loadMapFeed(fetchMapFeed, cachedHistory) {
  try {
    const response = await fetchMapFeed();
    return { markers: safeMapFeed(response), source: 'backend', message: null };
  } catch {
    const latestCachedHistory = typeof cachedHistory === 'function' ? cachedHistory() : cachedHistory;
    return {
      markers: mapMarkersFromHistory(latestCachedHistory),
      source: 'cache',
      message: 'Unable to refresh map markers. Cached markers are shown when available.',
    };
  }
}

const LOCATION_UNAVAILABLE = Object.freeze({
  location: null,
  state: 'unavailable',
  message: 'Current location is unavailable right now.',
});

export async function readCurrentMapLocation({ requestPermission, getCurrentPosition, accuracy } = {}) {
  try {
    const permission = await requestPermission();
    const granted = permission === true || permission?.granted === true;
    if (!granted) {
      return {
        location: null,
        state: 'permission-denied',
        message: 'Location permission is required to show your location.',
      };
    }

    const position = await getCurrentPosition(accuracy === undefined ? {} : { accuracy });
    const location = safeNormalizeMapCoordinate(position?.coords?.latitude, position?.coords?.longitude);
    if (!location) return { ...LOCATION_UNAVAILABLE };

    return { location, state: 'available', message: null };
  } catch {
    return { ...LOCATION_UNAVAILABLE };
  }
}

export function mapLoadMessage(state) {
  return state === 'failed' ? 'Map unavailable. Please try again.' : null;
}
