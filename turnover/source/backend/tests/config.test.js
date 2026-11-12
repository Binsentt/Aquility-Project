import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../database/pool.js';

test('development backend binds to LAN interfaces by default', async () => {
  const originalHost = process.env.HOST;
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.HOST;
  process.env.NODE_ENV = 'development';
  const { env } = await import('../config/env.js?config-test-default');

  assert.equal(env.bindHost, '0.0.0.0');

  if (originalHost === undefined) delete process.env.HOST;
  else process.env.HOST = originalHost;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

test('database pool keeps the clear missing DATABASE_URL error', () => {
  assert.throws(() => createPool(''), /DATABASE_URL is required for database operations/);
});
