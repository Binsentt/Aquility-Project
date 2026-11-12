import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadDiagnostics } from './uploadDiagnostics.js';
import { sha256Hex } from './sha256.js';

test('sha256Hex hashes the exact upload bytes', async () => {
  const bytes = new TextEncoder().encode('AQUALITY upload');
  assert.equal(
    await sha256Hex(bytes),
    '9f9495eb0f81283f4420b302310c0133df38560e1cc6ca2a964f7e9a4c7bd2c8',
  );
});

test('upload diagnostics preserve capture metadata and exact-file hash', () => {
  assert.deepEqual(
    createUploadDiagnostics({
      captureUri: 'file:///cache/water-strip.jpg',
      filename: 'water-strip.jpg',
      fileSize: 1234,
      mimeType: 'image/jpeg',
      pixelWidth: 1920,
      pixelHeight: 1080,
      source: 'camera',
      sha256: 'abc123',
    }),
    {
      captureUri: 'file:///cache/water-strip.jpg',
      filename: 'water-strip.jpg',
      fileSize: 1234,
      mimeType: 'image/jpeg',
      pixelWidth: 1920,
      pixelHeight: 1080,
      source: 'camera',
      sha256: 'abc123',
    },
  );
});
