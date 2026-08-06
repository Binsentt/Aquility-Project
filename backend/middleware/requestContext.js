import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export function requestContext(req, res, next) {
  const requestId = req.get('X-Request-Id') || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (!env.logRequests) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(JSON.stringify({ event: 'request-complete', requestId, method: req.method, status: res.statusCode, durationMs: Math.round(durationMs) }));
  });

  next();
}
