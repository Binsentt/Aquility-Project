import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exportSource = readFileSync(new URL('./exportService.js', import.meta.url), 'utf8');

test('PDF export resolves the backend image URI before building report HTML', () => {
  assert.match(exportSource, /const sourceImageUri = payload\.imageUri/);
  assert.match(exportSource, /const resolvedImageUri = await resolveExportImageUri\(sourceImageUri\)/);
  assert.match(exportSource, /imageUri: resolvedImageUri/);
});
