import dotenv from 'dotenv';

dotenv.config();

function asBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function asPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: asBoolean(process.env.DATABASE_SSL),
  databaseSslRejectUnauthorized: asBoolean(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, true),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || 10),
  databaseIdleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30_000),
  databaseConnectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 5_000),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || '',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '8h',
  mediaTokenTtl: process.env.MEDIA_TOKEN_TTL || '5m',
  guestArchiveDays: asPositiveInteger(process.env.GUEST_ARCHIVE_DAYS, 30),
  guestArchiveIntervalMs: asPositiveInteger(process.env.GUEST_ARCHIVE_INTERVAL_MS, 6 * 60 * 60 * 1000),
  logRequests: asBoolean(process.env.LOG_REQUESTS),
};
