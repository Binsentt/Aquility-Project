import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleSiteForClass } from './sampleSites.js';

const cameraSource = readFileSync(new URL('../components/CameraScanner/CameraView.js', import.meta.url), 'utf8');
const analysisServiceSource = readFileSync(new URL('./waterAnalysisService.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');
const historySource = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');

test('sample-site metadata stays authoritative and has fifteen selectable samples per class', () => {
  assert.equal(sampleSiteForClass('AA').siteName, 'Pawikan');
  assert.equal(sampleSiteForClass('A').siteName, 'Well');
  assert.equal(sampleSiteForClass('C').siteName, 'Fish Farm');
  assert.match(cameraSource, /Array\.from\(\{ length: 15 \}/);
  assert.match(cameraSource, /source: 'camera'/);
  assert.match(cameraSource, /source: 'gallery'/);
  assert.match(cameraSource, /sampleCode: selectedSampleCode/);
  assert.match(cameraSource, /sampleNumber: selectedSampleNumber/);
  assert.match(analysisServiceSource, /sampleClass: input\.sampleClass/);
});

test('result and history use completion and validation-ready wording', () => {
  for (const source of [resultSource, historySource]) {
    assert.match(source, /Scan Status/);
    assert.match(source, /displayMeasuredParametersStatus/);
    assert.match(source, /Laboratory Comparison/);
    assert.match(source, /Not entered yet/);
    assert.match(source, /displayScientificValidationStatus/);
  }
});
