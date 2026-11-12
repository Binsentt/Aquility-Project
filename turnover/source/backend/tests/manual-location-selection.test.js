import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmManualLocation,
  createManualLocationDraft,
  selectManualLocation,
} from '../../services/manualLocationSelection.js';

test('a map-picker draft needs an intentional tap before it can be confirmed', () => {
  const draft = createManualLocationDraft({ latitude: 14.6, longitude: 120.98 });

  assert.equal(confirmManualLocation(draft), null);

  const selected = selectManualLocation(draft, {
    nativeEvent: { lngLat: [121.1, 14.7] },
  });

  assert.deepEqual(confirmManualLocation(selected), { latitude: 14.7, longitude: 121.1 });
});

test('manual map coordinates contain no fabricated GPS accuracy or capture timestamp', () => {
  const selected = selectManualLocation(
    createManualLocationDraft({ latitude: 14.6, longitude: 120.98 }),
    { nativeEvent: { lngLat: [121.1, 14.7] } },
  );

  assert.deepEqual(confirmManualLocation(selected), { latitude: 14.7, longitude: 121.1 });
});

test('malformed or out-of-range map presses do not enable pin confirmation', () => {
  const draft = createManualLocationDraft({ latitude: 14.6, longitude: 120.98 });

  assert.equal(confirmManualLocation(selectManualLocation(draft, { nativeEvent: { lngLat: [null, null] } })), null);
  assert.equal(confirmManualLocation(selectManualLocation(draft, { nativeEvent: { lngLat: [181, 91] } })), null);
});
