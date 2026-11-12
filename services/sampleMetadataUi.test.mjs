import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_SITES, canonicalizeSampleClass, canonicalizeSampleCode, sampleSiteForClass } from './sampleSites.js';

const cameraSource = readFileSync(new URL('../components/CameraScanner/CameraView.js', import.meta.url), 'utf8');
const analysisServiceSource = readFileSync(new URL('./waterAnalysisService.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');
const historySource = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');

test('sample classes and codes canonicalize historical values', () => {
  assert.deepEqual(Object.keys(SAMPLE_SITES).sort(), ['A', 'SA', 'SB']);
  assert.equal(canonicalizeSampleClass('AA'), 'SA');
  assert.equal(canonicalizeSampleClass('A'), 'A');
  assert.equal(canonicalizeSampleClass('C'), 'SB');
  assert.equal(canonicalizeSampleCode('AA-01'), 'SA-01');
  assert.equal(canonicalizeSampleCode('A-01'), 'A-01');
  assert.equal(canonicalizeSampleCode('C-01'), 'SB-01');
  assert.equal(sampleSiteForClass('AA').classCode, 'SA');
  assert.equal(sampleSiteForClass('AA').siteName, 'Pawikan');
  assert.equal(sampleSiteForClass('A').siteName, 'Well');
  assert.equal(sampleSiteForClass('C').classCode, 'SB');
  assert.equal(sampleSiteForClass('C').siteName, 'Fish Farm');
});

test('scanner identifies samples by number without a water-class selection', async () => {
  const { unclassifiedSampleCodeForNumber } = await import('./sampleSites.js');

  assert.equal(unclassifiedSampleCodeForNumber?.(1), 'AQ-01');
  assert.equal(unclassifiedSampleCodeForNumber?.(15), 'AQ-15');
  assert.equal(unclassifiedSampleCodeForNumber?.(0), null);
  assert.equal(unclassifiedSampleCodeForNumber?.(16), null);
  assert.match(cameraSource, /const SAMPLE_NUMBERS = Array\.from\(\{ length: 15 \}/);
  assert.doesNotMatch(cameraSource, /SAMPLE_CLASSES|selectedSampleClass|Sample class/);
  assert.match(cameraSource, /Sample number/);
  assert.match(cameraSource, /unclassifiedSampleCodeForNumber/);
  assert.match(cameraSource, /sampleClass: null/);
  assert.match(cameraSource, /source: 'camera'/);
  assert.match(cameraSource, /source: 'gallery'/);
  assert.match(cameraSource, /sampleCode: selectedSampleCode/);
  assert.match(cameraSource, /sampleNumber: selectedSampleNumber/);
  assert.doesNotMatch(analysisServiceSource, /matchSampleSite\(/);
});

test('result and history omit client-facing laboratory comparison and scientific validation', () => {
  for (const source of [resultSource, historySource]) {
    assert.match(source, /Scan Status/);
    assert.match(source, /'Nitrite Status'/);
    assert.doesNotMatch(source, /Measured Parameters Status|Awaiting approved limits|displayMeasuredParametersStatus/);
    assert.doesNotMatch(source, /Laboratory Comparison|Scientific Validation|Pending laboratory/i);
  }
});

test('scanner reports GPS failures and offers an explicit retry or continue choice', () => {
  assert.match(cameraSource, /Location permission denied/);
  assert.match(cameraSource, /Enable location permission in device settings/);
  assert.match(cameraSource, /GPS location unavailable/);
  assert.match(cameraSource, /Try Again/);
  assert.match(cameraSource, /Continue Without GPS/);
  assert.match(cameraSource, /Location\.getCurrentPositionAsync\(\{ accuracy: Location\.Accuracy\.Balanced \}\)/);
  assert.match(cameraSource, /location,\s*manualLocation,\s*barangay: currentUser\.barangay/);
});
