import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_SITES, canonicalizeSampleClass, canonicalizeSampleCode, sampleSiteForClass } from './sampleSites.js';

const cameraSource = readFileSync(new URL('../components/CameraScanner/CameraView.js', import.meta.url), 'utf8');
const analysisServiceSource = readFileSync(new URL('./waterAnalysisService.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');
const historySource = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');

test('sample classes canonicalize historical values while the scanner offers only SA, A, and SB', () => {
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
  assert.match(cameraSource, /Array\.from\(\{ length: 15 \}/);
  assert.match(cameraSource, /code: 'SA'/);
  assert.match(cameraSource, /code: 'A'/);
  assert.match(cameraSource, /code: 'SB'/);
  assert.doesNotMatch(cameraSource, /code: '(?:AA|C)'/);
  assert.match(cameraSource, /source: 'camera'/);
  assert.match(cameraSource, /source: 'gallery'/);
  assert.match(cameraSource, /sampleCode: selectedSampleCode/);
  assert.match(cameraSource, /sampleNumber: selectedSampleNumber/);
  assert.match(analysisServiceSource, /sampleClass: input\.sampleClass/);
});

test('result and history omit client-facing laboratory comparison and scientific validation', () => {
  for (const source of [resultSource, historySource]) {
    assert.match(source, /Scan Status/);
    assert.match(source, /displayMeasuredParametersStatus/);
    assert.doesNotMatch(source, /Laboratory Comparison|Scientific Validation|Pending laboratory/i);
  }
});
