import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../database/migrations/001_initial_schema.sql', import.meta.url);

test('initial schema defines users and water_tests with credentials, results, and GPS columns', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  for (const table of ['users', 'water_tests']) {
    assert.match(sql, new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}`, 'i'));
  }

  for (const column of [
    'password_hash',
    'latitude',
    'longitude',
    'estimated_ph',
    'estimated_nitrate',
    'estimated_copper',
    'overall_status',
  ]) {
    assert.match(sql, new RegExp(column, 'i'));
  }
});
