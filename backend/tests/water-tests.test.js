import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

const authTokenService = {
  verifyAccessToken: () => ({ userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a' }),
};

const item = {
  id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
  userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
  imagePath: '/uploads/strip.jpg',
  latitude: 14.6,
  longitude: 120.98,
  barangay: 'San Isidro',
  municipality: 'Sample City',
  capturedAt: '2026-08-04T00:00:00.000Z',
  estimatedPH: 6.8,
  phStatus: 'Normal',
  estimatedNitrate: 3.5,
  nitrateStatus: 'Safe',
  estimatedCopper: 0.6,
  copperStatus: 'Safe',
  overallStatus: 'Safe',
  remarks: 'Water quality appears acceptable based on the current estimated values.',
  createdAt: '2026-08-04T00:01:00.000Z',
  user: { id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Ana Cruz', email: 'ana@example.test' },
};

test('GET /api/water-tests returns authenticated user records with the stable result shape', async () => {
  const app = createApp({
    authTokenService,
    waterTestService: {
      async list() { return [item]; },
      async getById() { return item; },
      async remove() {},
    },
  });

  const response = await request(app)
    .get('/api/water-tests?userId=8ed82724-1db6-452a-a872-f6e5c81d8b5a')
    .set('Authorization', 'Bearer valid-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.items[0].overallStatus, 'Safe');
  assert.deepEqual(response.body.items[0].gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(response.body.items[0].user.passwordHash, undefined);
});

test('DELETE /api/water-tests/:id returns no content', async () => {
  const app = createApp({
    authTokenService,
    waterTestService: {
      async list() { return []; },
      async getById() { return item; },
      async remove() {},
    },
  });

  const response = await request(app)
    .delete('/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6')
    .set('Authorization', 'Bearer valid-token');

  assert.equal(response.status, 204);
  assert.equal(response.text, '');
});
