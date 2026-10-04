import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toScanResult } from './apiMappers.js';
import { buildPdfHtml } from './reportTemplate.js';

const resultScreen = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');
const historyDetail = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');
const mapDetails = readFileSync(new URL('../components/MapLibreWaterMap.native.js', import.meta.url), 'utf8');

test('Result, History Detail, and PDF use the same persisted pH category and qualified Nitrite display', () => {
  const record = toScanResult({
    id: 'paired-result',
    sampleClass: 'C',
    sampleCode: 'C-01',
    pH: 7,
    nitrite: { value: null, displayValue: '>1 ppm', qualifier: '>', lowerBound: 1 },
    nitriteClassificationStatus: 'Dangerous',
  }, 'https://api.example.test/api');
  const pdf = buildPdfHtml({ test: record });

  assert.match(resultScreen, /'pH Category'/);
  assert.match(historyDetail, /'pH Category'/);
  assert.match(resultScreen, /'Nitrite Status'/);
  assert.match(historyDetail, /'Nitrite Status'/);
  assert.match(mapDetails, /Nitrite Status: \{displayText\(selectedMarker\.nitriteStatus\)\}/);
  assert.match(resultScreen, /sampleCode/);
  assert.match(historyDetail, /sampleCode/);
  assert.match(mapDetails, /value\.toFixed\(1\)/);
  assert.equal(record.resultData.pH, '7.0');
  assert.equal(record.resultData['pH Category'], 'Neutral');
  assert.equal(record.resultData.Nitrite, '>1 ppm');
  assert.equal(record.resultData['Nitrite Status'], 'Dangerous');
  assert.equal(record.sampleClass, 'SB');
  assert.equal(record.sampleCode, 'SB-01');
  assert.match(pdf, /pH:<\/strong> 7\.0/);
  assert.match(pdf, /pH Category:<\/strong> Neutral/);
  assert.match(pdf, /Nitrite:<\/strong> &gt;1 ppm/);
  assert.match(pdf, /Sample code:<\/strong> SB-01/);
  assert.match(pdf, /Sample class:<\/strong> SB/);
  assert.match(pdf, /Nitrite Status:<\/strong> Dangerous/);
  assert.doesNotMatch(pdf, /undefined|NaN/);
});
