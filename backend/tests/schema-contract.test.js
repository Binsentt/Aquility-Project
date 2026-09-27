import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../database/migrations/001_initial_schema.sql', import.meta.url);
const copperRemovalMigrationUrl = new URL('../database/migrations/004_remove_copper_parameter.sql', import.meta.url);
const nitriteMigrationUrl = new URL('../database/migrations/005_add_nitrite_analysis.sql', import.meta.url);

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
    'overall_status',
  ]) {
    assert.match(sql, new RegExp(column, 'i'));
  }
});

test('forward migration adds Nitrite metadata without deleting historical Nitrate values', async () => {
  const initialSql = await readFile(migrationUrl, 'utf8');
  const removalSql = await readFile(copperRemovalMigrationUrl, 'utf8');
  const nitriteSql = await readFile(nitriteMigrationUrl, 'utf8');

  assert.match(initialSql, /estimated_ph/i);
  assert.match(initialSql, /estimated_nitrate/i);
  assert.match(removalSql, /DROP COLUMN IF EXISTS estimated_copper/i);
  assert.match(removalSql, /DROP COLUMN IF EXISTS copper_status/i);
  assert.match(nitriteSql, /ADD COLUMN IF NOT EXISTS estimated_nitrite/i);
  assert.match(nitriteSql, /ADD COLUMN IF NOT EXISTS analysis_data JSONB/i);
  assert.match(nitriteSql, /ALTER COLUMN estimated_nitrate DROP NOT NULL/i);
  assert.doesNotMatch(nitriteSql, /DROP COLUMN[^;]*estimated_nitrate/i);
});
