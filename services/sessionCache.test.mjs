import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_KEYS, readOfflineState, writeOfflineState } from './sessionCache.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) || null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
    values,
  };
}

test('offline cache stores only a session, public profile, and API history snapshot', async () => {
  const storage = createStorage();
  const state = {
    currentUser: { id: 'user-1', fullName: 'Ana Cruz', accountType: 'registered' },
    scanHistory: [{ id: 'test-1', overallStatus: 'Safe' }],
  };

  await writeOfflineState(storage, state);
  const restored = await readOfflineState(storage);

  assert.deepEqual(restored, state);
  assert.equal(storage.values.has('aquility:registered-users'), false);
  assert.deepEqual(JSON.parse(storage.values.get(CACHE_KEYS.session)), { userId: 'user-1' });
});
