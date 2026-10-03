import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeSampleClass, canonicalizeSampleCode, matchSampleSite, sampleSiteForClass, SAMPLE_SITES } from '../services/sampleSites.js';

const configuredSites = {
  SA: { classCode: 'SA', name: 'Pawikan', sourceType: 'Coastal / Pawikan', latitude: 14.7000, longitude: 120.9000, radiusMeters: 500 },
  A: { classCode: 'A', name: 'Well', sourceType: 'Well / Groundwater', latitude: 14.7100, longitude: 120.9100, radiusMeters: 500 },
  SB: { classCode: 'SB', name: 'Fish Farm', sourceType: 'Fish Farm / Aquaculture', latitude: 14.7200, longitude: 120.9200, radiusMeters: 500 },
};

test('GPS matching selects Pawikan, Well, and Fish Farm inside configured radii', () => {
  assert.equal(matchSampleSite(14.7001, 120.9001, configuredSites).classCode, 'SA');
  assert.equal(matchSampleSite(14.7101, 120.9101, configuredSites).classCode, 'A');
  assert.equal(matchSampleSite(14.7201, 120.9201, configuredSites).classCode, 'SB');
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

test('selected sample classes resolve their authoritative study-site identity without GPS', () => {
  assert.deepEqual(sampleSiteForClass('SA'), {
    classCode: 'SA',
    siteName: 'Pawikan',
    sourceType: 'Coastal / Pawikan',
    latitude: null,
    longitude: null,
    distanceMeters: null,
  });
  assert.equal(sampleSiteForClass('A').siteName, 'Well');
  assert.equal(sampleSiteForClass('SB').siteName, 'Fish Farm');
  assert.equal(sampleSiteForClass('invalid'), null);
});

test('sample class and code compatibility aliases normalize to canonical values', () => {
  assert.deepEqual(Object.keys(SAMPLE_SITES).sort(), ['A', 'SA', 'SB']);
  assert.equal(canonicalizeSampleClass('AA'), 'SA');
  assert.equal(canonicalizeSampleClass('A'), 'A');
  assert.equal(canonicalizeSampleClass('C'), 'SB');
  assert.equal(canonicalizeSampleCode('AA-01'), 'SA-01');
  assert.equal(canonicalizeSampleCode('A-01'), 'A-01');
  assert.equal(canonicalizeSampleCode('C-01'), 'SB-01');
  assert.equal(sampleSiteForClass('AA').classCode, 'SA');
  assert.equal(sampleSiteForClass('C').classCode, 'SB');
});
