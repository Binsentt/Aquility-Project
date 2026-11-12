import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, validateSampleCode } from '../utils/validation.js';

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

test('sample codes accept canonical classes and normalize historical prefixes', () => {
  assert.equal(validateSampleCode('SA-01'), 'SA-01');
  assert.equal(validateSampleCode('A-01'), 'A-01');
  assert.equal(validateSampleCode('SB-15'), 'SB-15');
  assert.equal(validateSampleCode('AA-01'), 'SA-01');
  assert.equal(validateSampleCode('C-01'), 'SB-01');
  assert.throws(() => validateSampleCode('D-01'), (error) => error.code === 'INVALID_SAMPLE_CODE');
});
