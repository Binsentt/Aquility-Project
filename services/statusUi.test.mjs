import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(new URL('../screens/Home/HomeScreen.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');

test('Home and Result keep scan completion separate from parameter measurement status', () => {
  assert.match(homeSource, /title="Latest scan" value=\{latestScan \? latestScan\.scanStatus/);
  assert.match(homeSource, /title="Measured parameters"/);
  assert.match(resultSource, /Measured Parameters Status/);
  assert.match(resultSource, /displayMeasuredParametersStatus/);
  assert.doesNotMatch(resultSource, /displayScientificValidationStatus|Laboratory Comparison|Scientific Validation|Pending laboratory/i);
});
