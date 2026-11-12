export const DEFAULT_API_BASE_URL = 'https://aquality-api-production.up.railway.app/api';

function asExplicitBoolean(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === 'localhost.localdomain' || host === '::1' || host === '0.0.0.0') return true;
  if (host.startsWith('10.') || host.startsWith('127.') || host.startsWith('192.168.')) return true;
  const ipv4Match = host.match(/^172\.(\d{1,3})\./);
  return Boolean(ipv4Match && Number(ipv4Match[1]) >= 16 && Number(ipv4Match[1]) <= 31);
}

export function resolveApiBaseUrl({ configuredUrl, allowLocalApi = false } = {}) {
  const candidate = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  if (!candidate) return DEFAULT_API_BASE_URL;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return DEFAULT_API_BASE_URL;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_API_BASE_URL;
  if (isPrivateHost(parsed.hostname) && !asExplicitBoolean(allowLocalApi)) return DEFAULT_API_BASE_URL;
  return candidate.replace(/\/$/, '');
}
