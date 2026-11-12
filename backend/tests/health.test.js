import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

test('GET /api/health reports the manual-location capability when its database schema is available', async () => {
  const response = await request(createApp({ manualLocationCheck: async () => true })).get('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'aquility-api',
    features: { manualSampleLocation: true },
  });
});

test('GET /api/health reports a connected database without exposing connection details', async () => {
  const response = await request(createApp({ healthCheck: async () => true })).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.features.manualSampleLocation, false);
  assert.equal('databaseUrl' in response.body, false);
});
