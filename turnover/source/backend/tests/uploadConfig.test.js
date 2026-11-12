import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_BYTES } from '../middleware/uploadMiddleware.js';
import { REQUEST_BODY_LIMIT } from '../app.js';

test('analysis request limits support high-resolution camera and gallery images', () => {
  assert.equal(MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  assert.equal(REQUEST_BODY_LIMIT, '50mb');
});
