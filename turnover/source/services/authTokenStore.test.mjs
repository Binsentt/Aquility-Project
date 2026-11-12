import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('./authTokenStore.js', import.meta.url)), 'utf8');

test('SecureStore uses one key that satisfies the platform key contract', () => {
  const match = source.match(/const ACCESS_TOKEN_KEY = ['"]([^'"]+)['"]/);
  assert.ok(match, 'ACCESS_TOKEN_KEY declaration is required');
  assert.match(match[1], /^[A-Za-z0-9._-]+$/);
  assert.doesNotMatch(match[1], /:/);
});

test('SecureStore availability is checked without a key and token operations share the canonical key', () => {
  assert.match(source, /SecureStore\.isAvailableAsync\(\)/);
  assert.doesNotMatch(source, /SecureStore\.isAvailableAsync\([^)]/);
  assert.match(source, /SecureStore\.getItemAsync\(ACCESS_TOKEN_KEY\)/);
  assert.match(source, /SecureStore\.setItemAsync\(ACCESS_TOKEN_KEY,/);
  assert.match(source, /SecureStore\.deleteItemAsync\(ACCESS_TOKEN_KEY\)/);
});

test('missing or invalid token values do not crash token persistence', { skip: typeof mock.module !== 'function' ? 'requires Node module mocks' : false }, async () => {
  const secureStoreCalls = { availability: 0, saved: [], deleted: [] };
  mock.module('expo-secure-store', {
    namedExports: {
      isAvailableAsync: async (...args) => {
        secureStoreCalls.availability += args.length === 0 ? 1 : 100;
        return true;
      },
      getItemAsync: async () => null,
      setItemAsync: async (key, value) => { secureStoreCalls.saved.push({ key, value }); },
      deleteItemAsync: async (key) => { secureStoreCalls.deleted.push(key); },
    },
  });

  const { saveAccessToken, clearStoredAccessToken, getStoredAccessToken } = await import('./authTokenStore.js?token-regression');
  await assert.doesNotReject(() => saveAccessToken());
  await assert.doesNotReject(() => saveAccessToken(null));
  await assert.doesNotReject(() => saveAccessToken(''));
  await assert.doesNotReject(() => clearStoredAccessToken());
  await assert.doesNotReject(() => getStoredAccessToken());
  assert.equal(secureStoreCalls.saved.length, 0);
  assert.equal(secureStoreCalls.deleted.length, 1);
  assert.equal(secureStoreCalls.availability, 2);
});
