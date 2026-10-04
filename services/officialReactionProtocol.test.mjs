import test from 'node:test';
import assert from 'node:assert/strict';
import { officialReactionInstruction } from './officialReactionProtocol.js';

test('scanner guidance uses only the client-confirmed official reaction time', () => {
  assert.equal(officialReactionInstruction('SA'), 'Read/scan after 1 minute.');
  assert.equal(officialReactionInstruction('SB'), 'Read/scan after 20 minutes.');
  assert.equal(officialReactionInstruction('A'), 'Read/scan after 20 minutes.');
  assert.equal(officialReactionInstruction('AA'), 'Read/scan after 1 minute.');
  assert.equal(officialReactionInstruction('C'), 'Read/scan after 20 minutes.');
});

test('unknown sample classes receive no invented reaction-time guidance', () => {
  assert.equal(officialReactionInstruction('unknown'), null);
});
