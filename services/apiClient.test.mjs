import test from 'node:test';
import assert from 'node:assert/strict';
import { api, request, setUnauthorizedHandler } from './apiClient.js';

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
