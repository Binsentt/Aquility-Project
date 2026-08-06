import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const pool = createPool();

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const migrationFiles = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const migrationFile of migrationFiles) {
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [migrationFile]);
    if (existing.rowCount) {
      console.log(`Skipped ${migrationFile}`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(join(migrationsDir, migrationFile), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [migrationFile]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(`Applied ${migrationFile}`);
  }
} finally {
  await pool.end();
}
