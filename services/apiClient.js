import { apiBaseOrigin, resolveMediaUrl } from './apiMappers.js';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
let accessToken = null;
let unauthorizedHandler = null;
let unauthorizedNotification = null;
const sessionFailureCodes = new Set(['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_INACTIVE']);

export class ApiError extends Error {
  constructor(status, message, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getApiBaseUrl() {
  return configuredBaseUrl.replace(/\/$/, '');
}

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token.trim() ? token.trim() : null;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

async function notifyUnauthorized() {
  if (!unauthorizedHandler) return;
  if (!unauthorizedNotification) {
    unauthorizedNotification = Promise.resolve(unauthorizedHandler()).finally(() => {
      unauthorizedNotification = null;
    });
  }
  await unauthorizedNotification;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.message || 'The AQUILITY server could not complete this request.', body?.error?.code);
  }
  return body;
}

export async function request(path, options = {}) {
  const authorization = accessToken && !options.skipAuthorization ? { Authorization: `Bearer ${accessToken}` } : {};
  const headers = options.body instanceof FormData
    ? { Accept: 'application/json', ...authorization, ...(options.headers || {}) }
    : { Accept: 'application/json', 'Content-Type': 'application/json', ...authorization, ...(options.headers || {}) };
  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
  try {
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && sessionFailureCodes.has(error.code) && !options.skipUnauthorizedHandling) {
      await notifyUnauthorized();
    }
    throw error;
  }
}

function jsonRequest(method, body) {
  return { method, body: JSON.stringify(body) };
}

export const api = {
  createUser(payload) {
    return request('/users', jsonRequest('POST', payload));
  },
  updateUser(id, payload) {
    return request(`/users/${id}`, jsonRequest('PUT', payload));
  },
  getUser(id) {
    return request(`/users/${id}`);
  },
  login(payload) {
    return request('/auth/login', { ...jsonRequest('POST', payload), skipUnauthorizedHandling: true });
  },
  logout() {
    return request('/auth/logout', { method: 'POST' });
  },
  deleteAccount(password = null) {
    return request('/account', jsonRequest('DELETE', { password }));
  },
  listWaterTests(userId) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return request(`/water-tests${query}`);
  },
  getWaterTest(id) {
    return request(`/water-tests/${id}`);
  },
  deleteWaterTest(id) {
    return request(`/water-tests/${id}`, { method: 'DELETE' });
  },
  updateWaterTest(id, payload) {
    return request(`/water-tests/${id}`, jsonRequest('PUT', payload));
  },
  listMapMarkers() {
    return request('/map-markers');
  },
  setAccessToken,
  clearAccessToken,
  async analyzeWater({ imageUri, userId, gpsLatitude, gpsLongitude, barangay, municipality, capturedAt }) {
    if (!imageUri) {
      throw new ApiError(400, 'A captured water-test image is required.', 'IMAGE_REQUIRED');
    }
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: 'water-strip.jpg', type: 'image/jpeg' });
    formData.append('userId', userId);
    formData.append('gpsLatitude', gpsLatitude == null ? '' : String(gpsLatitude));
    formData.append('gpsLongitude', gpsLongitude == null ? '' : String(gpsLongitude));
    formData.append('barangay', barangay || '');
    formData.append('municipality', municipality || '');
    formData.append('capturedAt', capturedAt);
    return request('/analyze-water', { method: 'POST', body: formData });
  },
};

export { apiBaseOrigin, resolveMediaUrl };
