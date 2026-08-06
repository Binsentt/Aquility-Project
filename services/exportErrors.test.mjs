import test from 'node:test';
import assert from 'node:assert/strict';
import { toSafeExportMessage } from './exportErrors.js';

test('export errors preserve known user-safe messages', () => {
  const message = 'No image is available to export.';

  assert.equal(
    toSafeExportMessage(new Error(message), 'Unable to create the image export.'),
    message
  );
});

test('export errors replace filesystem and stack details with a generic message', () => {
  const unsafeError = new Error('ENOENT: no such file or directory, copy C:\\app\\exports\\report.pdf\n    at copyAsync');

  assert.equal(
    toSafeExportMessage(unsafeError, 'Unable to generate the PDF report.'),
    'Unable to generate the PDF report.'
  );
});
