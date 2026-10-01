import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const historyDetail = readFileSync(new URL('../screens/History/HistoryDetailScreen.js', import.meta.url), 'utf8');

test('History detail refreshes the authoritative record and renders safe image states', () => {
  assert.match(historyDetail, /useFocusEffect/);
  assert.match(historyDetail, /loadBackendWaterTest\(routeItem\.id\)/);
  assert.match(historyDetail, /setDetailItem\(record\)/);
  assert.match(historyDetail, /Loading image/);
  assert.match(historyDetail, /Image unavailable/);
  assert.match(historyDetail, /Retry/);
  assert.match(historyDetail, /AQUALITY HISTORY IMAGE DEBUG/);
  assert.doesNotMatch(historyDetail, /console\.(log|error).*token/);
});

test('History detail prefers a freshly mapped signed image URL over route cache', () => {
  assert.match(historyDetail, /const imageUri = item\.imageUri/);
  assert.match(historyDetail, /loadBackendWaterTest\(routeItem\.id\)/);
  assert.match(historyDetail, /imageUriExists/);
});
