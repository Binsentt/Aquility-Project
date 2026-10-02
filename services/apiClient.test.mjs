import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, api, getApiBaseUrl, getNetworkUnavailableMessage, normalizeImageAsset, request, setUnauthorizedHandler } from './apiClient.js';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
  };
}

test('shared API client attaches the active bearer token and removes it after logout', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(200, { ok: true });
  };

  try {
    api.setAccessToken('secure-token');
    await request('/health');
    api.clearAccessToken();
    await request('/health');

    assert.equal(requests[0].options.headers.Authorization, 'Bearer secure-token');
    assert.equal(requests[1].options.headers.Authorization, undefined);
  } finally {
    global.fetch = originalFetch;
    api.clearAccessToken();
  }
});

test('shared API client reports protected-request authorization loss once', async () => {
  const originalFetch = global.fetch;
  let unauthorizedCount = 0;
  global.fetch = async () => jsonResponse(401, { error: { code: 'TOKEN_EXPIRED', message: 'Session expired.' } });

  try {
    api.setAccessToken('expired-token');
    setUnauthorizedHandler(async () => { unauthorizedCount += 1; });
    await assert.rejects(() => request('/users/current'), { code: 'TOKEN_EXPIRED', status: 401 });
    assert.equal(unauthorizedCount, 1);
  } finally {
    global.fetch = originalFetch;
    setUnauthorizedHandler(null);
    api.clearAccessToken();
  }
});

test('account deletion uses the authenticated current-account endpoint with a password confirmation payload', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(204, null);
  };

  try {
    api.setAccessToken('secure-token');
    await api.deleteAccount('password123');

    assert.match(requests[0].url, /\/account$/);
    assert.equal(requests[0].options.method, 'DELETE');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer secure-token');
    assert.equal(requests[0].options.body, JSON.stringify({ password: 'password123' }));
  } finally {
    global.fetch = originalFetch;
    api.clearAccessToken();
  }
});

test('a rejected account-deletion password preserves the active session', async () => {
  const originalFetch = global.fetch;
  let unauthorizedCount = 0;
  global.fetch = async () => jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Your current password is incorrect.' } });

  try {
    api.setAccessToken('secure-token');
    setUnauthorizedHandler(async () => { unauthorizedCount += 1; });
    await assert.rejects(() => api.deleteAccount('wrong-password'), { code: 'INVALID_CREDENTIALS', status: 401 });
    assert.equal(unauthorizedCount, 0);
  } finally {
    global.fetch = originalFetch;
    setUnauthorizedHandler(null);
    api.clearAccessToken();
  }
});

test('HTTP authentication failures remain ApiError responses rather than transport failures', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' } });

  try {
    await assert.rejects(
      () => api.login({ email: 'user@example.test', password: 'wrong-password' }),
      (error) => {
        assert.equal(error instanceof ApiError, true);
        assert.equal(error.code, 'INVALID_CREDENTIALS');
        assert.equal(error.status, 401);
        assert.equal(error.message, 'Invalid credentials.');
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('network failures become a friendly AQUALITY server connection error', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new TypeError('fetch failed'); };

  try {
    await assert.rejects(
      () => request('/health'),
      { code: 'NETWORK_UNAVAILABLE', status: 0, message: 'Unable to connect to the AQUALITY server. Check your internet connection and try again.' },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('production HTTPS network failures do not mention the development computer or LAN', () => {
  const message = getNetworkUnavailableMessage('https://aquality-api-production.up.railway.app/api');
  assert.equal(message, 'Unable to connect to the AQUALITY server. Check your internet connection and try again.');
  assert.doesNotMatch(message, /same network|development computer|localhost|192\.168\./i);
});

test('network failures retain the transport cause and request URL for diagnostics', async () => {
  const originalFetch = global.fetch;
  const transportError = new TypeError('fetch failed: connection reset');
  global.fetch = async () => { throw transportError; };

  try {
    await assert.rejects(
      () => request('/analyze-water'),
      (error) => {
        assert.equal(error.code, 'NETWORK_UNAVAILABLE');
        assert.equal(error.cause, transportError);
        assert.equal(error.requestUrl, `${getApiBaseUrl()}/analyze-water`);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('analysis uploads use FormData without overriding the multipart boundary header', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(201, { analysisId: 'analysis-1' });
  };

  try {
    api.setAccessToken('secure-token');
    await api.analyzeWater({
      imageUri: 'file:///tmp/water-strip.jpg',
      userId: 'user-1',
      sampleClass: 'AA',
      sampleCode: 'AA-03',
      sampleNumber: 3,
      capturedAt: '2026-08-04T00:00:00.000Z',
    });

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/analyze-water$/);
    assert.equal(requests[0].options.headers['Content-Type'], undefined);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer secure-token');
    assert.equal(requests[0].options.body instanceof FormData, true);
    assert.equal(requests[0].options.body.get('userId'), 'user-1');
    assert.equal(requests[0].options.body.get('sampleClass'), 'AA');
    assert.equal(requests[0].options.body.get('sampleCode'), 'AA-03');
    assert.equal(requests[0].options.body.get('sampleNumber'), '3');
    assert.equal(requests[0].options.body.get('capturedAt'), '2026-08-04T00:00:00.000Z');
    assert.equal(requests[0].options.body.get('image') instanceof Blob, true);
  } finally {
    global.fetch = originalFetch;
    api.clearAccessToken();
  }
});

test('analysis upload preserves gallery filename and supported MIME metadata', () => {
  assert.deepEqual(
    normalizeImageAsset('content://media/strip-01.png', {
      fileName: 'strip-01.png',
      mimeType: 'image/png',
    }),
    {
      uri: 'content://media/strip-01.png',
      name: 'strip-01.png',
      type: 'image/png',
    },
  );
});

test('analysis upload does not relabel an unsupported gallery format as JPEG', () => {
  const asset = normalizeImageAsset('content://media/strip-01.heic', {
    fileName: 'strip-01.heic',
    mimeType: 'image/heic',
  });

  assert.equal(asset.name, 'strip-01.heic');
  assert.equal(asset.type, 'image/heic');
});

test('multipart API errors expose request and registration diagnostics', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => jsonResponse(422, {
    error: {
      code: 'STRIP_REGISTRATION_FAILED',
      message: 'The test strip could not be registered.',
      requestId: 'request-123',
      registrationFailureCode: 'SQUARE_NOT_FOUND',
    },
  });

  try {
    await assert.rejects(
      () => request('/analyze-water', { method: 'POST', body: new FormData() }),
      (error) => {
        assert.equal(error.requestId, 'request-123');
        assert.equal(error.registrationFailureCode, 'SQUARE_NOT_FOUND');
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
