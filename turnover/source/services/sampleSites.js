/**
 * Canonical study sampling sites. Exact coordinates are intentionally null
 * until the client supplies a GPS capture or verified map pin.
 */
export const SAMPLE_SITES = Object.freeze({
  SA: Object.freeze({ classCode: 'SA', name: 'Pawikan', sourceType: 'Coastal / Pawikan', latitude: null, longitude: null, radiusMeters: 500 }),
  A: Object.freeze({ classCode: 'A', name: 'Well', sourceType: 'Well / Groundwater', latitude: null, longitude: null, radiusMeters: 500 }),
  SB: Object.freeze({ classCode: 'SB', name: 'Fish Farm', sourceType: 'Fish Farm / Aquaculture', latitude: null, longitude: null, radiusMeters: 500 }),
});

const SAMPLE_CLASS_ALIASES = Object.freeze({ AA: 'SA', SA: 'SA', A: 'A', C: 'SB', SB: 'SB' });

export function canonicalizeSampleClass(classCode) {
  if (typeof classCode !== 'string') return null;
  return SAMPLE_CLASS_ALIASES[classCode.trim().toUpperCase()] || null;
}

export function canonicalizeSampleCode(sampleCode) {
  if (typeof sampleCode !== 'string') return null;
  const match = /^(AA|SA|A|C|SB)-(0[1-9]|1[0-5])$/i.exec(sampleCode.trim());
  if (!match) return null;
  return `${canonicalizeSampleClass(match[1])}-${match[2]}`;
}

export function sampleSiteForClass(classCode, sites = SAMPLE_SITES) {
  const canonicalClass = canonicalizeSampleClass(classCode);
  const site = canonicalClass ? sites?.[canonicalClass] : null;
  if (!site) return null;
  return {
    classCode: site.classCode,
    siteName: site.name,
    sourceType: site.sourceType,
    latitude: site.latitude == null ? null : Number(site.latitude),
    longitude: site.longitude == null ? null : Number(site.longitude),
    distanceMeters: null,
  };
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

export function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusMeters = 6371000;
  const dLatitude = toRadians(latitudeB - latitudeA);
  const dLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(dLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(dLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchSampleSite(latitude, longitude, sites = SAMPLE_SITES) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return { classCode: null, siteName: 'Unknown sampling site', sourceType: null, distanceMeters: null };
  }

  const matches = Object.values(sites)
    .filter((site) => Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)) && Number(site.radiusMeters) > 0)
    .map((site) => ({ site, distance: distanceMeters(parsedLatitude, parsedLongitude, Number(site.latitude), Number(site.longitude)) }))
    .filter(({ site, distance }) => distance <= Number(site.radiusMeters))
    .sort((left, right) => left.distance - right.distance);

  if (!matches.length) {
    return { classCode: null, siteName: 'Unknown sampling site', sourceType: null, distanceMeters: null };
  }

  const { site, distance } = matches[0];
  return {
    classCode: site.classCode,
    siteName: site.name,
    sourceType: site.sourceType,
    latitude: Number(site.latitude),
    longitude: Number(site.longitude),
    distanceMeters: Math.round(distance),
  };
}
