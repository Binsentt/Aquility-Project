import { canonicalizeSampleClass, canonicalizeSampleCode } from './sampleSites.js';

export function apiBaseOrigin(apiBaseUrl) {
  return apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export function resolveMediaUrl(path, apiBaseUrl) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('file:') || path.startsWith('data:')) return path;
  return `${apiBaseOrigin(apiBaseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function displayMeasuredParametersStatus(status) {
  return status === 'Not classified' ? 'Awaiting approved limits' : (status || 'Awaiting approved limits');
}

function finiteMeasurement(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

// Descriptive chemistry convention only; this is not a water-safety classification.
export function pHCategoryFor(value) {
  const pH = finiteMeasurement(value);
  if (pH == null) return null;
  if (pH < 7) return 'Acidic';
  if (pH > 7) return 'Alkaline';
  return 'Neutral';
}

export function cleanClientRemarks(value) {
  const remarks = typeof value === 'string' ? value : '';
  if (/client-provided provisional references|provisional client reference colors|analytically validated method|HSV H\/S\/V|scientific (?:validation|comparison)|laboratory (?:comparison|validation)|certified water-safety/i.test(remarks)) {
    return 'Separate µPAD sensing areas were localized. Results are shown only when a configured reference matches.';
  }
  return remarks;
}

export function toApiProfile(payload = {}) {
  const fullName = payload.fullName || [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim();
  return {
    fullName,
    email: payload.email?.trim() || null,
    phoneNumber: payload.phoneNumber || payload.contactNumber || null,
    barangay: payload.barangay?.trim() || null,
    municipality: payload.municipality?.trim() || null,
  };
}

export function toSessionUser(user = {}, fallback = {}) {
  const fullName = user.fullName || fallback.fullName || '';
  const [firstName = '', ...lastName] = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    ...fallback,
    ...user,
    firstName,
    lastName: lastName.join(' '),
    fullName,
    phoneNumber: user.phoneNumber || fallback.phoneNumber || fallback.contactNumber || '',
    contactNumber: user.phoneNumber || fallback.contactNumber || fallback.phoneNumber || '',
    isGuest: user.accountType === 'guest',
  };
}

export function toScanResult(waterTest = {}, apiBaseUrl) {
  const pH = finiteMeasurement(waterTest.pH);
  const pHCategory = pHCategoryFor(pH);
  const nitriteValue = finiteMeasurement(waterTest.nitrite?.value);
  const imageUri = resolveMediaUrl(waterTest.imageUri || waterTest.imagePath, apiBaseUrl);
  const measuredParametersStatus = waterTest.measuredParametersStatus || 'Not classified';
  const overallStatus = waterTest.overallStatus && waterTest.overallStatus !== 'Unvalidated'
    ? waterTest.overallStatus
    : 'NOT CLASSIFIED';
  const persisted = Boolean(waterTest.analysisId || waterTest.id);
  const pHResult = waterTest.pHResult || null;
  const sampleClassInput = waterTest.sampleClass || waterTest.sampleSite?.classCode || null;
  const sampleClass = canonicalizeSampleClass(sampleClassInput) || sampleClassInput;
  const sampleCodeInput = waterTest.sampleCode || null;
  const sampleCode = canonicalizeSampleCode(sampleCodeInput) || sampleCodeInput;
  const hasMeasuredRgb = (value) => Array.isArray(value?.measuredRGB)
    && value.measuredRGB.length === 3
    && value.measuredRGB.every((channel) => Number.isFinite(Number(channel)));
  const pHDisplay = typeof pH === 'number' ? pH.toFixed(2) : (hasMeasuredRgb(pHResult) ? 'No reference match' : 'Unavailable');
  const nitriteDisplay = typeof waterTest.nitrite?.displayValue === 'string' && waterTest.nitrite.displayValue.trim()
    ? waterTest.nitrite.displayValue
    : (Number.isFinite(nitriteValue) ? `${nitriteValue.toFixed(2)} ${waterTest.nitrite?.unit || 'ppm'}` : (hasMeasuredRgb(waterTest.nitrite) ? 'No reference match' : 'Unavailable'));
  const summary = cleanClientRemarks(waterTest.remarks || waterTest.summary)
    || 'Water test result received from the AQUALITY backend.';

  return {
    id: waterTest.analysisId || waterTest.id,
    title: waterTest.title || 'Water Test',
    status: overallStatus,
    overallStatus,
    summary,
    scanStatus: waterTest.scanStatus || (persisted ? 'Completed' : 'Pending'),
    analysisStatus: waterTest.analysisStatus || (persisted ? 'Completed' : 'Pending'),
    measuredParametersStatus,
    measuredParametersDisplayStatus: displayMeasuredParametersStatus(measuredParametersStatus),
    roiLocalizationStatus: waterTest.roiLocalizationStatus || 'STRIP REGISTRATION REQUIRED',
    warnings: [],
    recommendations: [],
    detectedParameters: ['pH', 'Nitrite'],
    createdAt: waterTest.analyzedAt || waterTest.createdAt || waterTest.capturedAt,
    generatedAt: waterTest.analyzedAt || waterTest.createdAt || waterTest.capturedAt,
    capturedAt: waterTest.capturedAt,
    images: imageUri ? [imageUri] : [],
    imageUri,
    image: imageUri,
    location: waterTest.gps || waterTest.location || null,
    actualLatitude: waterTest.actualLatitude ?? waterTest.gps?.latitude ?? waterTest.location?.latitude ?? null,
    actualLongitude: waterTest.actualLongitude ?? waterTest.gps?.longitude ?? waterTest.location?.longitude ?? null,
    barangay: waterTest.barangay || null,
    municipality: waterTest.municipality || null,
    sampleClass,
    siteName: waterTest.siteName || waterTest.sampleSite?.siteName || 'Unknown sampling site',
    sourceType: waterTest.sourceType || waterTest.sampleSite?.sourceType || null,
    user: waterTest.user || null,
    userId: waterTest.userId || waterTest.user?.id || null,
    resultData: {
      pH: pHDisplay,
      ...(pHCategory ? { 'pH Category': pHCategory } : {}),
      Nitrite: nitriteDisplay,
      'Measured Parameters Status': displayMeasuredParametersStatus(measuredParametersStatus),
    },
    pH,
    pHCategory,
    pHResult,
    phStatus: waterTest.phStatus || null,
    nitrite: waterTest.nitrite || null,
    sampleCode,
    sampleNumber: waterTest.sampleNumber == null ? null : Number(waterTest.sampleNumber),
    gpsAccuracyMeters: waterTest.gpsAccuracyMeters == null ? null : Number(waterTest.gpsAccuracyMeters),
    gpsCapturedAt: waterTest.gpsCapturedAt || null,
    canonicalLocation: waterTest.canonicalLocation || null,
    notes: summary,
    files: [],
    mode: 'backend',
    certified: false,
  };
}

export function markerColorFor(status) {
  switch (String(status || '').toLowerCase()) {
    case 'safe':
      return '#22A06B';
    case 'unsafe':
      return '#D92D20';
    case 'moderate':
      return '#D48A00';
    case 'not classified':
    case 'not_classified':
    case 'unvalidated':
    default:
      return '#718096';
  }
}

export function normalizeMapCoordinate(latitude, longitude) {
  if (latitude == null || longitude == null || String(latitude).trim() === '' || String(longitude).trim() === '') return null;
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);
  if (!Number.isFinite(normalizedLatitude) || normalizedLatitude < -90 || normalizedLatitude > 90) return null;
  if (!Number.isFinite(normalizedLongitude) || normalizedLongitude < -180 || normalizedLongitude > 180) return null;
  return { latitude: normalizedLatitude, longitude: normalizedLongitude };
}

export function toMapMarker(payload = {}) {
  if (!payload || typeof payload !== 'object') return null;
  if (!['string', 'number'].includes(typeof payload.id)) return null;
  const id = String(payload.id).trim();
  const coordinate = normalizeMapCoordinate(payload.latitude, payload.longitude);
  if (!id || !coordinate) return null;

  const rawDate = payload.capturedAt || payload.createdAt || null;
  const timestamp = rawDate == null ? null : Date.parse(rawDate);
  const createdAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  const overallStatus = payload.overallStatus || payload.status || 'NOT CLASSIFIED';
  const sampleClassInput = payload.sampleClass || null;
  const sampleClass = canonicalizeSampleClass(sampleClassInput) || sampleClassInput;
  const siteName = payload.siteName || 'Unknown sampling site';
  const pH = finiteMeasurement(payload.pH);
  const nitriteDisplayInput = [payload.nitriteDisplay, payload.nitrite?.displayValue, payload.resultData?.Nitrite]
    .find((value) => typeof value === 'string' && value.trim());
  const nitriteValue = finiteMeasurement(payload.nitrite?.value);
  const nitriteDisplay = nitriteDisplayInput?.trim()
    || (nitriteValue == null ? 'Unavailable' : `${nitriteValue.toFixed(2)} ppm`);

  return {
    id,
    coordinate,
    title: sampleClass && siteName ? `Class ${sampleClass} — ${siteName}` : (siteName || 'Water Test'),
    description: overallStatus,
    barangay: payload.barangay || 'Unavailable',
    municipality: payload.municipality || 'Unavailable',
    overallStatus,
    pinColor: markerColorFor(overallStatus),
    createdAt,
    sampleClass,
    siteName,
    sourceType: payload.sourceType || null,
    pH,
    pHCategory: pHCategoryFor(pH),
    nitriteDisplay,
  };
}

export function filterValidMapMarkers(items) {
  if (!Array.isArray(items)) return [];
  return items.map(toMapMarker).filter(Boolean);
}

export function safeMapFeed(response) {
  return filterValidMapMarkers(response?.items);
}
