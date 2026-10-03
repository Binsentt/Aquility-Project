import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toScanResult } from './apiMappers.js';
import { buildPdfHtml } from './reportTemplate.js';

const resultScreen = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');
const historyDetail = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');

test('Result, History Detail, and PDF use the same persisted pH category and qualified Nitrite display', () => {
  const record = toScanResult({
    id: 'paired-result',
    pH: 7,
    nitrite: { value: null, displayValue: '>1 ppm', qualifier: '>', lowerBound: 1 },
  }, 'https://api.example.test/api');
  const pdf = buildPdfHtml({ test: record });

  assert.match(resultScreen, /'pH Category'/);
  assert.match(historyDetail, /'pH Category'/);
  assert.equal(record.resultData.pH, '7.00');
  assert.equal(record.resultData['pH Category'], 'Neutral');
  assert.equal(record.resultData.Nitrite, '>1 ppm');
  assert.match(pdf, /pH:<\/strong> 7\.00/);
  assert.match(pdf, /pH Category:<\/strong> Neutral/);
  assert.match(pdf, /Nitrite:<\/strong> &gt;1 ppm/);
  assert.doesNotMatch(pdf, /Safe|Warning|Dangerous/);
});
