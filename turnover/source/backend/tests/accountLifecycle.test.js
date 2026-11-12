import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserModel } from '../models/userModel.js';
import { createUserService } from '../services/userService.js';
import { createGuestLifecycleService } from '../services/guestLifecycleService.js';

const userId = '8ed82724-1db6-452a-a872-f6e5c81d8b5a';

function createRecordingPool(row) {
  const calls = [];
  return {
    calls,
    async query(text, values = []) {
      calls.push({ text, values });
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    },
  };
}

test('user model exposes database lifecycle fields without exposing them through credential fields', async () => {
  const pool = createRecordingPool({
    id: userId,
    fullName: 'Guest Ana',
    email: null,
    phoneNumber: '09171234567',
    barangay: 'San Isidro',
    municipality: 'Sample City',
    passwordHash: null,
    accountType: 'guest',
    isArchived: false,
    archivedAt: null,
    guestExpiresAt: '2026-09-03T00:00:00.000Z',
    lastActiveAt: '2026-08-04T00:00:00.000Z',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  });

  const user = await createUserModel(pool).findById(userId);

  assert.equal(user.accountType, 'guest');
  assert.equal(user.isArchived, false);
  assert.equal(user.guestExpiresAt, '2026-09-03T00:00:00.000Z');
  assert.equal(user.lastActiveAt, '2026-08-04T00:00:00.000Z');
});

test('user model can find only active accounts for bearer-token enforcement', async () => {
  const pool = createRecordingPool({
    id: userId,
    fullName: 'Ana Cruz',
    email: 'ana@example.test',
    accountType: 'registered',
    isArchived: false,
  });
  const model = createUserModel(pool);

  assert.equal(typeof model.findActiveById, 'function');
  const user = await model.findActiveById(userId);

  assert.equal(user.id, userId);
  assert.match(pool.calls[0].text, /is_archived\s*=\s*FALSE/i);
  assert.deepEqual(pool.calls[0].values, [userId]);
});

test('user model archives only active guests and selects expired guest records by a parameterized cutoff', async () => {
  const pool = createRecordingPool({ id: userId, accountType: 'guest', isArchived: true });
  const model = createUserModel(pool);

  assert.equal(typeof model.archiveGuest, 'function');
  assert.equal(typeof model.archiveExpiredGuests, 'function');
  await model.archiveGuest(userId);
  await model.archiveExpiredGuests('2026-08-01T00:00:00.000Z');

  assert.match(pool.calls[0].text, /account_type\s*=\s*'guest'/i);
  assert.match(pool.calls[0].text, /is_archived\s*=\s*FALSE/i);
  assert.deepEqual(pool.calls[1].values, ['2026-08-01T00:00:00.000Z']);
});

test('guest creation stores an inactivity expiration derived from the configured archive period', async () => {
  let created = null;
  const service = createUserService({
    userModel: {
      async create(input) {
        created = input;
        return input;
      },
    },
    guestArchiveDays: 30,
    now: () => new Date('2026-08-04T00:00:00.000Z'),
  });

  await service.createGuest({ fullName: 'Guest Ana', phoneNumber: '09171234567' });

  assert.equal(created.accountType, 'guest');
  assert.equal(created.guestExpiresAt, '2026-09-03T00:00:00.000Z');
});

test('guest lifecycle archives expired guests using the configured inactivity cutoff and archives guests on logout', async () => {
  const calls = [];
  const lifecycle = createGuestLifecycleService({
    userModel: {
      async archiveExpiredGuests(cutoff) { calls.push({ type: 'expired', cutoff }); return []; },
      async archiveGuest(id) { calls.push({ type: 'logout', id }); return { id, isArchived: true }; },
    },
    guestArchiveDays: 30,
    now: () => new Date('2026-08-04T00:00:00.000Z'),
  });

  await lifecycle.archiveExpiredGuests();
  await lifecycle.archiveOnLogout({ id: userId, accountType: 'guest' });
  await lifecycle.archiveOnLogout({ id: userId, accountType: 'registered' });

  assert.deepEqual(calls, [
    { type: 'expired', cutoff: '2026-07-05T00:00:00.000Z' },
    { type: 'logout', id: userId },
  ]);
});
