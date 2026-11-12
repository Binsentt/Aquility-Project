import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256File } from '../utils/uploadDiagnostics.js';

test('upload diagnostics hash the received file bytes without exposing its path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aquality-upload-'));
  const filePath = join(directory, 'water-strip.jpg');
  try {
    await writeFile(filePath, Buffer.from('AQUALITY upload'));
    assert.equal(await sha256File(filePath), '9f9495eb0f81283f4420b302310c0133df38560e1cc6ca2a964f7e9a4c7bd2c8');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
