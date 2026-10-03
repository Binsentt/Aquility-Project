import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENFREEMAP_LIBERTY_STYLE,
  buildMapLibreMarkers,
  loadMapFeed,
  mapLoadReducer,
  mapLoadMessage,
  readCurrentMapLocation,
  toMapLibreLngLat,
} from './mapLibreMap.js';

test('MapLibre coordinate conversion uses longitude-first order and rejects invalid bounds', () => {
  assert.deepEqual(toMapLibreLngLat({ latitude: 14.5995, longitude: 120.9842 }), [120.9842, 14.5995]);
  assert.deepEqual(toMapLibreLngLat({ latitude: '-90', longitude: '180' }), [180, -90]);
  assert.equal(toMapLibreLngLat({ latitude: 90.01, longitude: 0 }), null);
  assert.equal(toMapLibreLngLat({ latitude: 0, longitude: -180.01 }), null);
  assert.equal(toMapLibreLngLat({ latitude: 'bad', longitude: 10 }), null);
  assert.equal(toMapLibreLngLat({ latitude: Symbol('invalid'), longitude: 10 }), null);
  for (const invalid of [true, [], {}]) {
    assert.equal(toMapLibreLngLat({ latitude: invalid, longitude: 10 }), null);
    assert.equal(toMapLibreLngLat({ latitude: 10, longitude: invalid }), null);
  }
  assert.equal(toMapLibreLngLat(null), null);
});

test('MapLibre render models support zero markers and ignore malformed marker objects', () => {
  assert.deepEqual(buildMapLibreMarkers([]), []);
  assert.deepEqual(buildMapLibreMarkers(null), []);
  assert.deepEqual(buildMapLibreMarkers([
    null,
    { id: '', coordinate: { latitude: 1, longitude: 2 } },
    { id: {}, coordinate: { latitude: 1, longitude: 2 } },
    { id: Number.NaN, coordinate: { latitude: 1, longitude: 2 } },
    { id: Number.POSITIVE_INFINITY, coordinate: { latitude: 1, longitude: 2 } },
    { id: Number.NEGATIVE_INFINITY, coordinate: { latitude: 1, longitude: 2 } },
    { id: 'missing-coordinate' },
    { id: 'invalid-coordinate', coordinate: { latitude: 95, longitude: 2 } },
    { id: 'boolean-coordinate', coordinate: { latitude: true, longitude: 2 } },
    { id: 'array-coordinate', coordinate: { latitude: 1, longitude: [] } },
    { id: 'object-coordinate', coordinate: { latitude: {}, longitude: 2 } },
  ]), []);
});

test('MapLibre render models retain safe marker details, add lngLat, and exclude user data without mutation', () => {
  const source = {
    id: 'water-test-1',
    title: 'Class AA — Pawikan',
    description: 'Safe',
    coordinate: { latitude: 14.5995, longitude: 120.9842 },
    barangay: 'San Isidro',
    municipality: 'Sample City',
    overallStatus: 'Safe',
    pinColor: '#22A06B',
    createdAt: '2026-10-03T01:02:03.000Z',
    sampleClass: 'AA',
    siteName: 'Pawikan',
    sourceType: 'Coastal',
    user: { email: 'private@example.test' },
    phoneNumber: 'private',
  };
  const before = structuredClone(source);
  const rendered = buildMapLibreMarkers([source]);

  assert.deepEqual(rendered, [{
    id: 'water-test-1',
    title: 'Class AA — Pawikan',
    description: 'Safe',
    coordinate: { latitude: 14.5995, longitude: 120.9842 },
    lngLat: [120.9842, 14.5995],
    barangay: 'San Isidro',
    municipality: 'Sample City',
    overallStatus: 'Safe',
    pinColor: '#22A06B',
    createdAt: '2026-10-03T01:02:03.000Z',
    sampleClass: 'AA',
    siteName: 'Pawikan',
    sourceType: 'Coastal',
  }]);
  assert.deepEqual(source, before);
  assert.doesNotMatch(JSON.stringify(rendered), /private@example\.test|phoneNumber|"user"/);
});

test('MapLibre render models support one and multiple sanitized markers', () => {
  const one = buildMapLibreMarkers([{
    id: 'one',
    coordinate: { latitude: 0, longitude: 0 },
    title: 'One',
    description: 'Moderate',
  }]);
  const many = buildMapLibreMarkers([
    { id: 'one', coordinate: { latitude: 0, longitude: 0 } },
    { id: 'two', coordinate: { latitude: 1, longitude: 2 } },
    { id: 'three', coordinate: { latitude: -3, longitude: 4 } },
  ]);

  assert.equal(one.length, 1);
  assert.deepEqual(one[0].lngLat, [0, 0]);
  assert.equal(many.length, 3);
  assert.deepEqual(many.map(({ id }) => id), ['one', 'two', 'three']);
  assert.deepEqual(many.map(({ lngLat }) => lngLat), [[0, 0], [2, 1], [4, -3]]);
});

test('MapLibre marker rendering drops duplicate IDs after normalization to prevent unstable native keys', () => {
  const markers = buildMapLibreMarkers([
    { id: 1, coordinate: { latitude: 10, longitude: 20 }, title: 'first' },
    { id: '1', coordinate: { latitude: 11, longitude: 21 }, title: 'duplicate-string' },
    { id: 'unique', coordinate: { latitude: 12, longitude: 22 }, title: 'unique' },
    { id: 'unique', coordinate: { latitude: 13, longitude: 23 }, title: 'duplicate-id' },
  ]);

  assert.deepEqual(markers.map(({ id, title }) => [id, title]), [['1', 'first'], ['unique', 'unique']]);
});

test('map load timeout, failure, success, and retry transitions remain recoverable', () => {
  assert.equal(mapLoadReducer('loading', 'timeout'), 'failed');
  assert.equal(mapLoadReducer('loading', 'failed'), 'failed');
  assert.equal(mapLoadReducer('failed', 'retry'), 'loading');
  assert.equal(mapLoadReducer('loading', 'ready'), 'ready');
  assert.equal(mapLoadReducer('ready', 'timeout'), 'ready');
  assert.equal(mapLoadReducer('ready', 'failed'), 'failed');
  assert.equal(mapLoadReducer('failed', 'ready'), 'ready');
});

test('current location does not request GPS when permission is denied', async () => {
  let gpsCalls = 0;
  const result = await readCurrentMapLocation({
    requestPermission: async () => ({ granted: false }),
    getCurrentPosition: async () => { gpsCalls += 1; return { coords: { latitude: 1, longitude: 2 } }; },
  });

  assert.equal(gpsCalls, 0);
  assert.deepEqual(result, {
    location: null,
    state: 'permission-denied',
    message: 'Location permission is required to show your location.',
  });
});

test('current location returns validated internal latitude/longitude after permission is granted', async () => {
  let receivedOptions;
  const result = await readCurrentMapLocation({
    accuracy: 'balanced',
    requestPermission: async () => true,
    getCurrentPosition: async (options) => {
      receivedOptions = options;
      return { coords: { latitude: '14.5995', longitude: '120.9842' } };
    },
  });

  assert.deepEqual(receivedOptions, { accuracy: 'balanced' });
  assert.deepEqual(result, {
    location: { latitude: 14.5995, longitude: 120.9842 },
    state: 'available',
    message: null,
  });
});

test('current location reports unavailable when GPS coordinates are missing or invalid', async () => {
  for (const position of [null, {}, { coords: { latitude: 91, longitude: 0 } }]) {
    assert.deepEqual(await readCurrentMapLocation({
      requestPermission: async () => ({ granted: true }),
      getCurrentPosition: async () => position,
    }), {
      location: null,
      state: 'unavailable',
      message: 'Current location is unavailable right now.',
    });
  }
});

test('current location converts permission and GPS exceptions to safe unavailable states', async () => {
  const permissionFailure = await readCurrentMapLocation({
    requestPermission: async () => { throw new Error('permission internals'); },
    getCurrentPosition: async () => { throw new Error('must not run'); },
  });
  const gpsFailure = await readCurrentMapLocation({
    requestPermission: async () => ({ granted: true }),
    getCurrentPosition: async () => { throw new Error('gps internals'); },
  });

  for (const result of [permissionFailure, gpsFailure]) {
    assert.deepEqual(result, {
      location: null,
      state: 'unavailable',
      message: 'Current location is unavailable right now.',
    });
    assert.doesNotMatch(result.message, /internals/);
  }
});

test('OpenFreeMap style failure has a recoverable message without surfacing errors for other states', () => {
  assert.equal(OPENFREEMAP_LIBERTY_STYLE, 'https://tiles.openfreemap.org/styles/liberty');
  assert.equal(mapLoadMessage('failed'), 'Map unavailable. Please try again.');
  assert.equal(mapLoadMessage('loading'), null);
  assert.equal(mapLoadMessage('ready'), null);
  assert.equal(mapLoadMessage(null), null);
});

test('map feed treats the backend as authoritative and uses validated cached markers only on network failure', async () => {
  const cachedTests = [
    {
      id: 'cached-one',
      location: { latitude: 14.5, longitude: 120.9 },
      overallStatus: 'Safe',
      createdAt: '2026-10-03T01:02:03Z',
      barangay: 'San Isidro',
      municipality: 'Sample City',
    },
    { id: 'bad', location: { latitude: 95, longitude: 0 } },
  ];
  let fetched = 0;
  const backend = await loadMapFeed(async () => {
    fetched += 1;
    return { items: [{ id: 'server-one', latitude: 1, longitude: 2 }] };
  }, cachedTests);

  assert.equal(fetched, 1);
  assert.equal(backend.source, 'backend');
  assert.equal(backend.message, null);
  assert.deepEqual(backend.markers.map(({ id }) => id), ['server-one']);

  const authoritativeEmpty = await loadMapFeed(async () => ({ items: [] }), cachedTests);
  assert.equal(authoritativeEmpty.source, 'backend');
  assert.deepEqual(authoritativeEmpty.markers, []);

  const unavailable = await loadMapFeed(async () => { throw new Error('secret/network details'); }, cachedTests);
  assert.equal(unavailable.source, 'cache');
  assert.deepEqual(unavailable.markers.map(({ id }) => id), ['cached-one']);
  assert.match(unavailable.message, /Unable to refresh map markers/);
  assert.doesNotMatch(unavailable.message, /secret|network details/);
});

test('map feed reads the latest cached history only after the API request fails', async () => {
  let latestHistory = [{ id: 'before', location: { latitude: 1, longitude: 2 } }];
  const pendingFetch = loadMapFeed(async () => {
    latestHistory = [{ id: 'after', location: { latitude: 3, longitude: 4 } }];
    throw new Error('offline');
  }, () => latestHistory);
  const result = await pendingFetch;

  assert.equal(result.source, 'cache');
  assert.deepEqual(result.markers.map(({ id }) => id), ['after']);
});
