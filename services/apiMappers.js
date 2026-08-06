export function apiBaseOrigin(apiBaseUrl) {
  return apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export function resolveMediaUrl(path, apiBaseUrl) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('file:') || path.startsWith('data:')) return path;
  return `${apiBaseOrigin(apiBaseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
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
  const pH = Number(waterTest.pH);
  const nitrateValue = Number(waterTest.nitrate?.value);
  const copperValue = Number(waterTest.copper?.value);
  const imageUri = resolveMediaUrl(waterTest.imageUri || waterTest.imagePath, apiBaseUrl);

  return {
    id: waterTest.analysisId || waterTest.id,
    title: waterTest.title || 'Water Test',
    status: waterTest.overallStatus || waterTest.status || 'Moderate',
    overallStatus: waterTest.overallStatus || waterTest.status || 'Moderate',
    summary: waterTest.remarks || waterTest.summary || 'Water test result received from the AQUILITY backend.',
    analysisStatus: 'Backend mock analysis',
    interpretation: 'This result uses replaceable mock calibration data until the validated colour-analysis method is supplied.',
    warnings: [],
    recommendations: [],
    detectedParameters: ['pH', 'Nitrate', 'Copper (Cu²⁺)'],
    createdAt: waterTest.analyzedAt || waterTest.createdAt || waterTest.capturedAt,
    generatedAt: waterTest.analyzedAt || waterTest.createdAt || waterTest.capturedAt,
    capturedAt: waterTest.capturedAt,
    images: imageUri ? [imageUri] : [],
    imageUri,
    image: imageUri,
    location: waterTest.gps || waterTest.location || null,
    barangay: waterTest.barangay || null,
    municipality: waterTest.municipality || null,
    user: waterTest.user || null,
    userId: waterTest.userId || waterTest.user?.id || null,
    resultData: {
      pH: Number.isFinite(pH) ? pH.toFixed(2) : 'Unavailable',
      Nitrate: Number.isFinite(nitrateValue) ? `${nitrateValue.toFixed(2)} ${waterTest.nitrate?.unit || 'mg/L'}` : 'Unavailable',
      'Copper (Cu²⁺)': Number.isFinite(copperValue) ? `${copperValue.toFixed(3)} ${waterTest.copper?.unit || 'mg/L'}` : 'Unavailable',
      'Overall Status': waterTest.overallStatus || waterTest.status || 'Unavailable',
    },
    pH,
    phStatus: waterTest.phStatus || null,
    nitrate: waterTest.nitrate || null,
    copper: waterTest.copper || null,
    notes: waterTest.remarks || '',
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
    default:
      return '#D48A00';
  }
}
