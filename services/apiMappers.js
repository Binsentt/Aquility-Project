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
  const pH = waterTest.pH == null ? null : Number.isFinite(Number(waterTest.pH)) ? Number(waterTest.pH) : waterTest.pH;
  const nitriteValue = Number(waterTest.nitrite?.value);
  const imageUri = resolveMediaUrl(waterTest.imageUri || waterTest.imagePath, apiBaseUrl);

  return {
    id: waterTest.analysisId || waterTest.id,
    title: waterTest.title || 'Water Test',
    status: waterTest.overallStatus || waterTest.status || 'Moderate',
    overallStatus: waterTest.overallStatus || waterTest.status || 'Moderate',
    summary: waterTest.remarks || waterTest.summary || 'Water test result received from the AQUALITY backend.',
    analysisStatus: waterTest.overallStatus === 'Unvalidated' ? 'Color analysis; scientific validation pending' : 'Color analysis',
    interpretation: 'pH uses client-provided Lab references and CIEDE2000. Nitrite uses provisional client-provided hue calibration. Neither result is a certified laboratory measurement.',
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
    barangay: waterTest.barangay || null,
    municipality: waterTest.municipality || null,
    user: waterTest.user || null,
    userId: waterTest.userId || waterTest.user?.id || null,
    resultData: {
      pH: typeof pH === 'number' ? pH.toFixed(2) : pH || 'Unavailable',
      Nitrite: Number.isFinite(nitriteValue) ? `${nitriteValue.toFixed(2)} ${waterTest.nitrite?.unit || 'ppm'}` : 'Unavailable',
      'Overall Status': waterTest.overallStatus || waterTest.status || 'Unavailable',
    },
    pH,
    pHResult: waterTest.pHResult || null,
    phStatus: waterTest.phStatus || null,
    nitrite: waterTest.nitrite || null,
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
