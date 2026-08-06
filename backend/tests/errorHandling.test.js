import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../middleware/errorHandler.js';

function createResponse() {
  return {
    headersSent: false,
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('database constraint and timeout errors return safe consistent responses', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const duplicate = createResponse();
    errorHandler({ code: '23505', name: 'DatabaseError' }, { requestId: 'request-1' }, duplicate, () => {});
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.body.error.code, 'DUPLICATE_RESOURCE');

    const unavailable = createResponse();
    errorHandler({ code: '57014', name: 'DatabaseError' }, { requestId: 'request-2' }, unavailable, () => {});
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(unavailable.body.error.message.includes('57014'), false);
  } finally {
    console.error = originalError;
  }
});
