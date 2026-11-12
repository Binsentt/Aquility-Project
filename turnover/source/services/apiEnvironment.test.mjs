import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './apiEnvironment.js';

test('defaults to the Railway API when no endpoint is configured', () => {
  assert.equal(resolveApiBaseUrl({ configuredUrl: '' }), DEFAULT_API_BASE_URL);
});

test('ignores a stale private LAN endpoint without an explicit local override', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'http://192.168.1.56:4000/api', allowLocalApi: false }),
    DEFAULT_API_BASE_URL,
  );
});

test('ignores localhost without an explicit local override', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'http://localhost:4000/api', allowLocalApi: false }),
    DEFAULT_API_BASE_URL,
  );
});

test('ignores loopback IPv4 without an explicit local override', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'http://127.0.0.1:4000/api', allowLocalApi: false }),
    DEFAULT_API_BASE_URL,
  );
});

test('allows an explicit local endpoint override', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'http://192.168.1.56:4000/api', allowLocalApi: true }),
    'http://192.168.1.56:4000/api',
  );
});

test('preserves a configured non-local HTTPS endpoint', () => {
  assert.equal(
    resolveApiBaseUrl({ configuredUrl: 'https://staging.example.test/api', allowLocalApi: false }),
    'https://staging.example.test/api',
  );
});
