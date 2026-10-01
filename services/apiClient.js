import { apiBaseOrigin, resolveMediaUrl } from './apiMappers.js';
import { createMultipartFile, normalizeImageAsset } from './multipartUpload.js';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
const networkUnavailableMessage = 'Unable to connect to the AQUALITY server. Make sure your device and development computer are connected to the same network and the server is running.';
const uploadDebugEnabled = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_AQUALITY_DEBUG === 'true';
let accessToken = null;
let unauthorizedHandler = null;
let unauthorizedNotification = null;
const sessionFailureCodes = new Set(['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_INACTIVE']);
export class ApiError extends Error {
  constructor(status, message, code = 'API_ERROR', { cause, requestUrl } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    if (cause) this.cause = cause;
    if (requestUrl) this.requestUrl = requestUrl;
  }
}

export function getApiBaseUrl() {
  return configuredBaseUrl.replace(/\/$/, '');
}

function uploadUriScheme(uri) {
  return typeof uri === 'string' && uri.includes(':') ? uri.split(':', 1)[0].toLowerCase() : 'unknown';
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
    throw new ApiError(response.status, body?.error?.message || 'The AQUALITY server could not complete this request.', body?.error?.code);
  }
  return body;
}

export async function request(path, options = {}) {
  const requestUrl = `${getApiBaseUrl()}${path}`;
  const isMultipart = options.body instanceof FormData;
  const authorization = accessToken && !options.skipAuthorization ? { Authorization: `Bearer ${accessToken}` } : {};
  const headers = isMultipart
    ? { Accept: 'application/json', ...authorization, ...(options.headers || {}) }
    : { Accept: 'application/json', 'Content-Type': 'application/json', ...authorization, ...(options.headers || {}) };
  let response;
  try {
    const fetchImplementation = isMultipart ? (options.multipartFetch || globalThis.fetch) : globalThis.fetch;
    const { multipartFetch: _multipartFetch, ...requestOptions } = options;
    response = await fetchImplementation(requestUrl, { ...requestOptions, headers });
    if (isMultipart && uploadDebugEnabled) {
      console.info('[AQUALITY UPLOAD DEBUG]', { requestUrl, responseStatus: response.status });
    }
  } catch (cause) {
    if (uploadDebugEnabled) {
      console.error('[AQUALITY API DEBUG]', {
        requestUrl,
        errorName: cause?.name || 'Error',
        errorMessage: cause?.message || 'Unknown transport error',
        cause: cause?.cause?.message || null,
      });
    }
    throw new ApiError(0, networkUnavailableMessage, 'NETWORK_UNAVAILABLE', { cause, requestUrl });
  }
  try {
    return await parseResponse(response);
  } catch (error) {
    if (isMultipart && uploadDebugEnabled) {
      console.info('[AQUALITY UPLOAD DEBUG]', {
        requestUrl,
        responseStatus: error?.status || 0,
        apiErrorCode: error?.code || null,
        message: error?.message || 'Unknown upload error',
      });
    }
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
  async analyzeWater({ imageUri, imageAsset, imageFile, uploadDiagnostics, multipartFetch, userId, gpsLatitude, gpsLongitude, gpsAccuracyMeters, gpsCapturedAt, barangay, municipality, sampleClass, sampleCode, sampleNumber, siteName, sourceType, capturedAt }) {
    if (!imageUri) {
      throw new ApiError(400, 'A captured water-test image is required.', 'IMAGE_REQUIRED');
    }
    const upload = imageFile
      ? { file: imageFile, descriptor: normalizeImageAsset(imageUri, imageAsset), ...(uploadDiagnostics || {}) }
      : await createMultipartFile(imageUri, imageAsset);
    const formData = new FormData();
    formData.append('image', upload.file);
    if (uploadDebugEnabled) {
      console.info('[AQUALITY UPLOAD DEBUG]', {
        source: imageAsset?.source || 'unknown',
        requestUrl: `${getApiBaseUrl()}/analyze-water`,
        imageUriScheme: uploadUriScheme(imageUri),
        fileName: upload.fileName || upload.descriptor.name,
        fileType: upload.fileType || upload.descriptor.type,
        fileSize: upload.fileSize ?? null,
        fileExists: upload.fileExists ?? null,
        userIdPresent: Boolean(userId),
        formDataCreated: true,
      });
    }
    formData.append('userId', userId);
    formData.append('gpsLatitude', gpsLatitude == null ? '' : String(gpsLatitude));
    formData.append('gpsLongitude', gpsLongitude == null ? '' : String(gpsLongitude));
    formData.append('gpsAccuracyMeters', gpsAccuracyMeters == null ? '' : String(gpsAccuracyMeters));
    formData.append('gpsCapturedAt', gpsCapturedAt || capturedAt || '');
    formData.append('barangay', barangay || '');
    formData.append('municipality', municipality || '');
    formData.append('sampleClass', sampleClass || '');
    formData.append('sampleCode', sampleCode || '');
    formData.append('sampleNumber', sampleNumber == null ? '' : String(sampleNumber));
    formData.append('siteName', siteName || '');
    formData.append('sourceType', sourceType || '');
    formData.append('capturedAt', capturedAt);
    return request('/analyze-water', { method: 'POST', body: formData, multipartFetch });
  },
};

export { apiBaseOrigin, normalizeImageAsset, resolveMediaUrl };
