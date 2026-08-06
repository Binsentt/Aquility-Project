import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from '../utils/validation.js';

test('profile validation accepts a normalized phone number and rejects non-phone text', () => {
  const profile = validateProfile({
    fullName: 'Ana Cruz',
    email: 'ana@company.com',
    phoneNumber: '+63 917-123-4567',
  }, { requireEmail: true });

  assert.equal(profile.phoneNumber, '+639171234567');
  assert.throws(
    () => validateProfile({ fullName: 'Ana Cruz', email: 'ana@company.com', phoneNumber: 'not-a-number' }, { requireEmail: true }),
    (error) => error.code === 'INVALID_PHONE_NUMBER'
  );
});
