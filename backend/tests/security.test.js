import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { createAuthTokenService } from '../services/authTokenService.js';

const userA = { id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Ana Cruz', email: 'ana@example.test' };
const userB = { id: '2ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Ben Cruz', email: 'ben@example.test' };

function createTokenService() {
  return {
    issueAccessToken(user) {
      return `token-${user.id}`;
    },
    verifyAccessToken(token) {
      if (token === `token-${userA.id}`) return { userId: userA.id };
      if (token === `token-${userB.id}`) return { userId: userB.id };
      const error = new Error('Invalid token');
      error.code = 'TOKEN_INVALID';
      throw error;
    },
  };
}

function createSecureApp() {
  return createApp({
    authTokenService: createTokenService(),
    authService: {
      async login() { return userA; },
      async register() { return userA; },
    },
    userService: {
      async createGuest() { return userA; },
      async getById(id) { return id === userA.id ? userA : userB; },
      async requireActiveSession(id) { return id === userA.id ? userA : userB; },
      async update(id, payload) { return { ...(id === userA.id ? userA : userB), ...payload }; },
      async remove() {},
    },
    waterTestService: {
      async list({ userId }) { return userId === userA.id ? [] : [{ id: 'other-user-test' }]; },
      async getById(id) { return { id, userId: userA.id }; },
      async update(id, payload) { return { id, userId: userA.id, ...payload }; },
      async remove() {},
    },
    mapService: {
      async listMarkers() {
        return [{
          id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
          latitude: 14.6,
          longitude: 120.98,
          overallStatus: 'Safe',
          capturedAt: '2026-08-04T00:00:00.000Z',
          barangay: 'San Isidro',
          municipality: 'Sample City',
        }];
      },
    },
  });
}

test('login issues an additive bearer token alongside the existing public user response', async () => {
  const response = await request(createSecureApp())
    .post('/api/auth/login')
    .send({ email: userA.email, password: 'password123' });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, userA.id);
  assert.equal(response.body.token, `token-${userA.id}`);
  assert.equal(response.body.user.passwordHash, undefined);
});

test('personal profile routes require a valid bearer token', async () => {
  const response = await request(createSecureApp()).get(`/api/users/${userA.id}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTH_REQUIRED');
});

test('profile routes reject a token that belongs to another user', async () => {
  const response = await request(createSecureApp())
    .get(`/api/users/${userB.id}`)
    .set('Authorization', `Bearer token-${userA.id}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('an archived or deleted account cannot use an otherwise valid bearer token', async () => {
  const app = createApp({
    authTokenService: createTokenService(),
    authService: { async login() { return userA; }, async register() { return userA; } },
    userService: {
      async createGuest() { return userA; },
      async getById() { return null; },
      async requireActiveSession() { return null; },
      async update() { return userA; },
      async remove() {},
    },
  });

  const response = await request(app)
    .get(`/api/users/${userA.id}`)
    .set('Authorization', `Bearer token-${userA.id}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'ACCOUNT_INACTIVE');
});

test('guest logout archives the authenticated guest on the server', async () => {
  let archivedUserId = null;
  const app = createApp({
    authTokenService: createTokenService(),
    authService: { async login() { return userA; }, async register() { return userA; } },
    userService: {
      async createGuest() { return userA; },
      async getById() { return userA; },
      async requireActiveSession() { return { ...userA, accountType: 'guest' }; },
      async update() { return userA; },
      async remove() {},
    },
    guestLifecycleService: {
      async archiveOnLogout(id) { archivedUserId = id; },
    },
  });

  const response = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer token-${userA.id}`);

  assert.equal(response.status, 204);
  assert.equal(archivedUserId?.id, userA.id);
});

test('account deletion is authenticated and forwards only the token subject with its password confirmation', async () => {
  let deletionRequest = null;
  const app = createApp({
    authTokenService: createTokenService(),
    authService: { async login() { return userA; }, async register() { return userA; } },
    userService: {
      async createGuest() { return userA; },
      async getById() { return userA; },
      async requireActiveSession() { return { ...userA, accountType: 'registered' }; },
      async update() { return userA; },
      async remove() {},
    },
    accountService: {
      async removeCurrent(input) { deletionRequest = input; },
    },
  });

  const response = await request(app)
    .delete('/api/account')
    .set('Authorization', `Bearer token-${userA.id}`)
    .send({ password: 'password123' });

  assert.equal(response.status, 204);
  assert.deepEqual(deletionRequest, { userId: userA.id, password: 'password123' });
});

test('water-test history rejects a changed userId even with a valid bearer token', async () => {
  const response = await request(createSecureApp())
    .get(`/api/water-tests?userId=${userB.id}`)
    .set('Authorization', `Bearer token-${userA.id}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('authenticated map feed contains only anonymous marker data', async () => {
  const response = await request(createSecureApp())
    .get('/api/map-markers')
    .set('Authorization', `Bearer token-${userA.id}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, [{
    id: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    latitude: 14.6,
    longitude: 120.98,
    overallStatus: 'Safe',
    capturedAt: '2026-08-04T00:00:00.000Z',
    barangay: 'San Isidro',
    municipality: 'Sample City',
  }]);
  assert.equal('user' in response.body.items[0], false);
  assert.equal('imagePath' in response.body.items[0], false);
  assert.equal('email' in response.body.items[0], false);
});

test('a signed water-test image URL cannot be changed to access another record', async () => {
  const authTokenService = createAuthTokenService({ secret: 'a-test-only-secret-that-is-long-enough-to-sign-tokens' });
  const signedImageToken = authTokenService.issueMediaToken({
    waterTestId: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    userId: userA.id,
  });
  const app = createApp({
    authTokenService,
    waterTestService: {
      async getById(id) { return { id, userId: userA.id, imagePath: '/uploads/missing.jpg' }; },
      async list() { return []; },
      async update() { return null; },
      async remove() {},
    },
  });

  const response = await request(app).get(`/api/water-tests/4ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=${encodeURIComponent(signedImageToken)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('a signed image link stops working when its account is archived or deleted', async () => {
  const tokenService = createAuthTokenService({ secret: 'a-test-only-secret-that-is-long-enough-to-sign-tokens' });
  const signedImageToken = tokenService.issueMediaToken({
    waterTestId: '3ec25331-d511-491f-a1b6-11670bc4a2d6',
    userId: userA.id,
  });
  const app = createApp({
    authTokenService: tokenService,
    userService: { async requireActiveSession() { return null; } },
    waterTestService: {
      async getById() { return { id: '3ec25331-d511-491f-a1b6-11670bc4a2d6', userId: userA.id, imagePath: '/uploads/missing.jpg' }; },
      async list() { return []; },
      async update() { return null; },
      async remove() {},
    },
  });

  const response = await request(app)
    .get(`/api/water-tests/3ec25331-d511-491f-a1b6-11670bc4a2d6/image?token=${encodeURIComponent(signedImageToken)}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'ACCOUNT_INACTIVE');
});

test('an expired bearer token returns a consistent session-expired error', async () => {
  const expiredTokenService = createAuthTokenService({
    secret: 'a-test-only-secret-that-is-long-enough-to-sign-tokens',
    accessTokenTtl: '-1s',
  });
  const expiredToken = expiredTokenService.issueAccessToken(userA);
  const app = createApp({
    authTokenService: expiredTokenService,
    authService: { async login() { return userA; }, async register() { return userA; } },
    userService: { async getById() { return userA; }, async update() { return userA; }, async remove() {}, async createGuest() { return userA; } },
  });

  const response = await request(app)
    .get(`/api/users/${userA.id}`)
    .set('Authorization', `Bearer ${expiredToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'TOKEN_EXPIRED');
});
