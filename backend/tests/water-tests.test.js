import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';

const authTokenService = {
  verifyAccessToken: () => ({ userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a' }),
  issueMediaToken: ({ waterTestId }) => `signed-${waterTestId}`,
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
  estimatedNitrite: 10,
  nitriteStatus: 'Unvalidated',
  analysisData: {
    pH: { value: 6, unit: 'pH', measuredRGB: [200, 190, 40], measuredLab: [80, -10, 60], matchedReference: { label: '6' }, deltaE00: 2.1 },
    nitrite: { value: 10, unit: 'ppm', measuredRGB: [255, 128, 64], hue: 30, calibrationInterval: { hue: [15, 30], ppm: [0, 10] }, interpolationMethod: 'piecewise-linear-clamped' },
  },
  overallStatus: 'Unvalidated',
  remarks: 'Client calibration output requires experimental validation.',
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
  assert.equal(response.body.items[0].overallStatus, 'NOT CLASSIFIED');
  assert.equal(response.body.items[0].nitrite.value, 10);
  assert.equal(response.body.items[0].nitrite.unit, 'ppm');
  assert.equal(response.body.items[0].resultData.Nitrite, '10.00 ppm');
  assert.deepEqual(response.body.items[0].gps, { latitude: 14.6, longitude: 120.98 });
  assert.equal(response.body.items[0].user.passwordHash, undefined);
  assert.equal(response.body.items[0].imageUri, '/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=signed-3ec25331-d511-491f-a1b6-11670bc4a2d6');
  assert.notEqual(response.body.items[0].imageUri, item.imagePath);
});

test('GET water-test detail and PUT preserve private signed image URLs', async () => {
  const app = createApp({
    authTokenService,
    waterTestService: {
      async list() { return [item]; },
      async getById() { return item; },
      async update() { return item; },
      async remove() {},
    },
  });

  const detail = await request(app)
    .get(`/api/water-tests/${item.id}`)
    .set('Authorization', 'Bearer valid-token');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.imageUri, `/api/water-tests/${item.id}/image?token=signed-${item.id}`);
  assert.equal(/\/uploads\//.test(detail.body.imageUri), false);
  assert.notEqual(detail.body.imageUri, item.imagePath);

  const update = await request(app)
    .put(`/api/water-tests/${item.id}`)
    .set('Authorization', 'Bearer valid-token')
    .send({});
  assert.equal(update.status, 200);
  assert.equal(update.body.imageUri, `/api/water-tests/${item.id}/image?token=signed-${item.id}`);
  assert.equal(/\/uploads\//.test(update.body.imageUri), false);
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
