import test from 'node:test';
import assert from 'node:assert/strict';
import { matchSampleSite } from '../services/sampleSites.js';

const configuredSites = {
  AA: { classCode: 'AA', name: 'Pawikan', sourceType: 'Coastal / Pawikan', latitude: 14.7000, longitude: 120.9000, radiusMeters: 500 },
  A: { classCode: 'A', name: 'Well', sourceType: 'Well / Groundwater', latitude: 14.7100, longitude: 120.9100, radiusMeters: 500 },
  C: { classCode: 'C', name: 'Fish Farm', sourceType: 'Fish Farm / Aquaculture', latitude: 14.7200, longitude: 120.9200, radiusMeters: 500 },
};

test('GPS matching selects Pawikan, Well, and Fish Farm inside configured radii', () => {
  assert.equal(matchSampleSite(14.7001, 120.9001, configuredSites).classCode, 'AA');
  assert.equal(matchSampleSite(14.7101, 120.9101, configuredSites).classCode, 'A');
  assert.equal(matchSampleSite(14.7201, 120.9201, configuredSites).classCode, 'C');
});

test('GPS outside every configured site returns an unknown sampling site', () => {
  assert.deepEqual(matchSampleSite(15.5, 121.5, configuredSites), {
    classCode: null,
    siteName: 'Unknown sampling site',
    sourceType: null,
    distanceMeters: null,
  });
});

test('the fifteen samples in each class retain one canonical site identity', () => {
  for (const [classCode, site] of Object.entries(configuredSites)) {
    const records = Array.from({ length: 15 }, () => matchSampleSite(site.latitude, site.longitude, configuredSites));
    assert.equal(new Set(records.map((record) => record.classCode)).size, 1);
    assert.equal(new Set(records.map((record) => record.siteName)).size, 1);
    assert.equal(records[0].classCode, classCode);
    assert.equal(records[0].siteName, site.name);
  }
});
