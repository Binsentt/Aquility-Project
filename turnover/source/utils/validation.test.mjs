import test from 'node:test';
import assert from 'node:assert/strict';
import { loginValidationSchema, registerValidationSchema } from './validation.js';

test('login validation accepts valid non-Gmail email domains', async () => {
  for (const email of ['user@gmail.com', 'user@yahoo.com', 'user@outlook.com', 'user@school.edu', 'user@company.com']) {
    const result = await loginValidationSchema.validate({ email, password: 'Password1!' });
    assert.equal(result.email, email);
  }
});

test('registration validation accepts a valid non-Gmail email address', async () => {
  const result = await registerValidationSchema.validate({
    firstName: 'Ana',
    lastName: 'Cruz',
    email: 'ana@company.com',
    password: 'Password1!',
    confirmPassword: 'Password1!',
    phoneNumber: '09171234567',
  });

  assert.equal(result.email, 'ana@company.com');
});
