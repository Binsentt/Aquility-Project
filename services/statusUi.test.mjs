import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(new URL('../screens/Home/HomeScreen.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');

test('Home treats persisted scan completion separately from scientific validation', () => {
  assert.match(homeSource, /title="Latest scan" value=\{latestScan \? latestScan\.scanStatus/);
  assert.match(homeSource, /title="Measured parameters"/);
  assert.match(resultSource, /Measured Parameters Status/);
  assert.match(resultSource, /displayMeasuredParametersStatus/);
  assert.match(resultSource, /displayScientificValidationStatus/);
  assert.match(resultSource, /Laboratory Comparison/);
});
