import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { rm } from 'node:fs/promises';
import { createApp } from '../app.js';

const user = { id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Proxy Test', email: 'proxy@example.test' };

function tokenService() {
  return {
    issueAccessToken() { return 'proxy-token'; },
    verifyAccessToken(token) {
      if (token === 'proxy-token') return { userId: user.id };
      throw new Error('invalid token');
    },
  };
}

test('auth rate limiter accepts Railway forwarded headers when one proxy hop is trusted', async () => {
  const app = createApp({
    trustProxyHops: 1,
    authTokenService: tokenService(),
    authService: { async login() { return user; } },
  });

  const response = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ email: user.email, password: 'password123' });

  assert.equal(response.status, 200);
  assert.equal(response.body.token, 'proxy-token');
});

test('analysis rate limiter accepts Railway forwarded headers without disabling rate limiting', async () => {
  const app = createApp({
    trustProxyHops: 1,
    authTokenService: tokenService(),
    waterAnalysisService: {
      async analyze({ file }) {
        await rm(file.path, { force: true });
        return { analysisId: file.filename };
      },
    },
  });

  const response = await request(app)
    .post('/api/analyze-water')
    .set('Authorization', 'Bearer proxy-token')
    .set('X-Forwarded-For', '203.0.113.11')
    .field('userId', user.id)
    .field('capturedAt', '2026-10-01T00:00:00.000Z')
    .attach('image', Buffer.from('fixture'), { filename: 'strip.jpg', contentType: 'image/jpeg' });

  assert.equal(response.status, 201);
  assert.match(response.body.analysisId, /\.upload$/);
});
