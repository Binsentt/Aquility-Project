import pg from 'pg';
import { env } from '../config/env.js';

export function createPool(connectionString = env.databaseUrl) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for database operations.');
  }

  return new pg.Pool({
    connectionString,
    max: env.databasePoolMax,
    idleTimeoutMillis: env.databaseIdleTimeoutMs,
    connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
    ssl: env.databaseSsl ? { rejectUnauthorized: env.databaseSslRejectUnauthorized } : undefined,
  });
}
