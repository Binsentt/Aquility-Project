import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthService } from '../services/authService.js';
import { createApp } from '../app.js';

function createTokenService() {
  return {
    issueAccessToken(user) { return `token-${user.id}`; },
    verifyAccessToken(token) {
      if (token === 'token-8ed82724-1db6-452a-a872-f6e5c81d8b5a') return { userId: '8ed82724-1db6-452a-a872-f6e5c81d8b5a' };
      throw new Error('Invalid token');
    },
  };
}

function createFakeUserModel() {
  let storedUser = null;

  return {
    async create(input) {
      storedUser = {
        id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a',
        ...input,
        createdAt: '2026-08-04T00:00:00.000Z',
      };
      return storedUser;
    },
    async findByEmail(email) {
      return storedUser?.email === email ? storedUser : null;
    },
    archiveStoredUser() {
      storedUser = storedUser ? { ...storedUser, isArchived: true } : null;
    },
  };
}

test('registration hashes a password and returns only the public user', async () => {
  const authService = createAuthService({ userModel: createFakeUserModel() });

  const user = await authService.register({
    fullName: 'Ana Cruz',
    email: 'ana@example.test',
    phoneNumber: '09171234567',
    password: 'password123',
  });

  assert.equal(user.fullName, 'Ana Cruz');
  assert.equal(user.password, undefined);
  assert.equal(user.passwordHash, undefined);
});

test('login route rejects an invalid password without exposing account data', async () => {
  const authService = createAuthService({ userModel: createFakeUserModel() });
  await authService.register({
    fullName: 'Ana Cruz',
    email: 'ana@example.test',
    password: 'password123',
  });
  const app = createApp({ authService, authTokenService: createTokenService() });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'ana@example.test', password: 'incorrect-password' });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(response.body.user, undefined);
});

test('login rejects an archived account only after the password is valid', async () => {
  const userModel = createFakeUserModel();
  const authService = createAuthService({ userModel });
  await authService.register({
    fullName: 'Ana Cruz',
    email: 'ana@example.test',
    password: 'password123',
  });
  userModel.archiveStoredUser();

  await assert.rejects(
    authService.login({ email: 'ana@example.test', password: 'password123' }),
    (error) => error.code === 'ACCOUNT_ARCHIVED'
  );
});

test('authenticated user profile routes expose create, get, update, and delete operations only to the token owner', async () => {
  const user = { id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Ana Cruz', email: 'ana@example.test' };
  let accountDeletion = null;
  const app = createApp({
    authTokenService: createTokenService(),
    authService: {
      async register() { return user; },
      async login() { return user; },
    },
    userService: {
      async createGuest(payload) { return { ...user, ...payload, accountType: 'guest' }; },
      async list() { return [user]; },
      async getById() { return user; },
      async requireActiveSession() { return user; },
      async update(id, payload) { return { ...user, id, ...payload }; },
      async remove() {},
    },
    accountService: {
      async removeCurrent(input) { accountDeletion = input; },
    },
  });

  const created = await request(app).post('/api/users').send({ ...user, password: 'password123' });
  assert.equal(created.status, 201);
  assert.equal(created.body.token, `token-${user.id}`);
  assert.equal((await request(app).get(`/api/users/${user.id}`).set('Authorization', `Bearer token-${user.id}`)).body.user.id, user.id);
  assert.equal((await request(app).put(`/api/users/${user.id}`).set('Authorization', `Bearer token-${user.id}`).send({ ...user, fullName: 'Ana Santos' })).body.user.fullName, 'Ana Santos');
  assert.equal((await request(app).delete(`/api/users/${user.id}`).set('Authorization', `Bearer token-${user.id}`).send({ password: 'password123' })).status, 204);
  assert.deepEqual(accountDeletion, { userId: user.id, password: 'password123' });
});

test('user creation rejects a missing request body and unsupported account type with validation errors', async () => {
  const user = { id: '8ed82724-1db6-452a-a872-f6e5c81d8b5a', fullName: 'Ana Cruz', email: 'ana@example.test' };
  const app = createApp({
    authTokenService: { issueAccessToken: () => 'access-token', verifyAccessToken: () => ({ userId: user.id }) },
    authService: { async register() { return user; } },
    userService: { async createGuest() { return user; } },
  });

  const missingBody = await request(app).post('/api/users');
  const unsupportedAccountType = await request(app)
    .post('/api/users')
    .send({ fullName: 'Ana Cruz', email: 'ana@example.test', password: 'StrongPass1!', accountType: 'operator' });

  assert.equal(missingBody.status, 400);
  assert.equal(missingBody.body.error.code, 'FULL_NAME_REQUIRED');
  assert.equal(unsupportedAccountType.status, 400);
  assert.equal(unsupportedAccountType.body.error.code, 'INVALID_ACCOUNT_TYPE');
});
