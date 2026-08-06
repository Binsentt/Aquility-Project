import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

test('GET /api/health reports the AQUILITY API identity', async () => {
  const response = await request(createApp()).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'aquility-api',
  });
});

test('GET /api/health reports a connected database without exposing connection details', async () => {
  const response = await request(createApp({ healthCheck: async () => true })).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal('databaseUrl' in response.body, false);
});
