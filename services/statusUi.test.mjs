import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(new URL('../screens/Home/HomeScreen.js', import.meta.url), 'utf8');
const resultSource = readFileSync(new URL('../screens/Result/ResultScreen.js', import.meta.url), 'utf8');

test('Home and Result show per-parameter results without a generic measured-parameters status', () => {
  assert.match(homeSource, /title="Latest scan" value=\{latestScan \? latestScan\.scanStatus/);
  assert.doesNotMatch(homeSource, /Measured parameters|Measured Parameters Status|displayMeasuredParametersStatus/);
  assert.match(resultSource, /'Nitrite Status'/);
  assert.doesNotMatch(resultSource, /Measured Parameters Status|Awaiting approved limits|displayMeasuredParametersStatus/);
  assert.doesNotMatch(resultSource, /displayScientificValidationStatus|Laboratory Comparison|Scientific Validation|Pending laboratory/i);
});
