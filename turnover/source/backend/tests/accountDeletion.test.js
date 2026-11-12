import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createWaterTestService } from '../services/waterTestService.js';

const accountServiceModule = await import('../services/accountService.js').catch(() => null);

const userId = '8ed82724-1db6-452a-a872-f6e5c81d8b5a';
const testId = '3ec25331-d511-491f-a1b6-11670bc4a2d6';

test('permanent scan deletion stages its owned upload, commits the owner-scoped row deletion, then finalizes the file', async () => {
  const events = [];
  const client = {
    async query(sql) { events.push(sql); },
    release() { events.push('release'); },
  };
  const service = createWaterTestService({
    pool: { async connect() { return client; } },
    waterTestModel: {
      async findById() { return { id: testId, userId, imagePath: '/uploads/strip.jpg' }; },
      async remove() { events.push('legacy-remove'); return true; },
      async removeOwned(id, ownerId, executor) {
        events.push({ type: 'remove-owned', id, ownerId, executor });
        return true;
      },
    },
    uploadDeletionService: {
      async stage(paths) {
        events.push({ type: 'stage', paths });
        return {
          async restore() { events.push('restore'); },
          async finalize() { events.push('finalize'); },
        };
      },
    },
  });

  await service.remove(testId, userId);

  assert.deepEqual(events, [
    'BEGIN',
    { type: 'stage', paths: ['/uploads/strip.jpg'] },
    { type: 'remove-owned', id: testId, ownerId: userId, executor: client },
    'COMMIT',
    'release',
    'finalize',
  ]);
});

test('a transaction failure restores staged scan uploads and does not finalize them', async () => {
  const events = [];
  const client = {
    async query(sql) { events.push(sql); },
    release() { events.push('release'); },
  };
  const service = createWaterTestService({
    pool: { async connect() { return client; } },
    waterTestModel: {
      async findById() { return { id: testId, userId, imagePath: '/uploads/strip.jpg' }; },
      async remove() { return true; },
      async removeOwned() { throw new Error('database write failed'); },
    },
    uploadDeletionService: {
      async stage() {
        events.push('stage');
        return {
          async restore() { events.push('restore'); },
          async finalize() { events.push('finalize'); },
        };
      },
    },
  });

  await assert.rejects(service.remove(testId, userId), /database write failed/);
  assert.deepEqual(events, ['BEGIN', 'stage', 'ROLLBACK', 'restore', 'release']);
});

test('registered account deletion requires the current password and removes only the authenticated account transactionally', async () => {
  assert.equal(typeof accountServiceModule?.createAccountService, 'function');
  const events = [];
  const client = {
    async query(sql) { events.push(sql); },
    release() { events.push('release'); },
  };
  const registeredUser = {
    id: userId,
    accountType: 'registered',
    isArchived: false,
    passwordHash: await bcrypt.hash('password123', 4),
  };
  const service = accountServiceModule.createAccountService({
    pool: { async connect() { return client; } },
    userModel: {
      async findById() { return registeredUser; },
      async findByIdForDeletion(id, executor) {
        events.push({ type: 'lock-user', id, executor });
        return registeredUser;
      },
      async removeOwned(id, executor) {
        events.push({ type: 'remove-user', id, executor });
        return true;
      },
    },
    waterTestModel: {
      async listOwnedForDeletion(id, executor) {
        events.push({ type: 'lock-tests', id, executor });
        return [{ imagePath: '/uploads/first.jpg' }, { imagePath: '/uploads/second.jpg' }];
      },
    },
    uploadDeletionService: {
      async stage(paths) {
        events.push({ type: 'stage', paths });
        return {
          async restore() { events.push('restore'); },
          async finalize() { events.push('finalize'); },
        };
      },
    },
  });

  await assert.rejects(
    service.removeCurrent({ userId, password: 'wrong-password' }),
    (error) => error.code === 'INVALID_CREDENTIALS'
  );
  assert.deepEqual(events, []);

  await service.removeCurrent({ userId, password: 'password123' });
  assert.deepEqual(events, [
    'BEGIN',
    { type: 'lock-user', id: userId, executor: client },
    { type: 'lock-tests', id: userId, executor: client },
    { type: 'stage', paths: ['/uploads/first.jpg', '/uploads/second.jpg'] },
    { type: 'remove-user', id: userId, executor: client },
    'COMMIT',
    'release',
    'finalize',
  ]);
});

test('guest account deletion does not require a password and restores staged files when database deletion fails', async () => {
  assert.equal(typeof accountServiceModule?.createAccountService, 'function');
  const events = [];
  const client = {
    async query(sql) { events.push(sql); },
    release() { events.push('release'); },
  };
  const service = accountServiceModule.createAccountService({
    pool: { async connect() { return client; } },
    userModel: {
      async findById() { return { id: userId, accountType: 'guest', isArchived: false, passwordHash: null }; },
      async findByIdForDeletion() { return { id: userId, accountType: 'guest', isArchived: false }; },
      async removeOwned() { throw new Error('database write failed'); },
    },
    waterTestModel: {
      async listOwnedForDeletion() { return [{ imagePath: '/uploads/guest.jpg' }]; },
    },
    uploadDeletionService: {
      async stage() {
        events.push('stage');
        return {
          async restore() { events.push('restore'); },
          async finalize() { events.push('finalize'); },
        };
      },
    },
  });

  await assert.rejects(service.removeCurrent({ userId }), /database write failed/);
  assert.deepEqual(events, ['BEGIN', 'stage', 'ROLLBACK', 'restore', 'release']);
});
