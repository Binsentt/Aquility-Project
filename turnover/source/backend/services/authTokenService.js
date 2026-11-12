import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
  return secret;
}

export function createAuthTokenService({
  secret = env.jwtSecret,
  accessTokenTtl = env.accessTokenTtl,
  mediaTokenTtl = env.mediaTokenTtl,
} = {}) {
  const signingSecret = requireSecret(secret);

  return {
    issueAccessToken(user) {
      return jwt.sign({ type: 'access' }, signingSecret, {
        subject: user.id,
        expiresIn: accessTokenTtl,
        issuer: 'aquility-api',
        audience: 'aquility-mobile',
      });
    },
    verifyAccessToken(token) {
      const payload = jwt.verify(token, signingSecret, { issuer: 'aquility-api', audience: 'aquility-mobile' });
      if (payload.type !== 'access' || typeof payload.sub !== 'string') {
        const error = new Error('Invalid token');
        error.code = 'TOKEN_INVALID';
        throw error;
      }
      return { userId: payload.sub };
    },
    issueMediaToken({ waterTestId, userId }) {
      return jwt.sign({ type: 'water-test-image', waterTestId, userId }, signingSecret, {
        expiresIn: mediaTokenTtl,
        issuer: 'aquility-api',
        audience: 'aquility-media',
      });
    },
    verifyMediaToken(token) {
      const payload = jwt.verify(token, signingSecret, { issuer: 'aquility-api', audience: 'aquility-media' });
      if (payload.type !== 'water-test-image' || typeof payload.waterTestId !== 'string' || typeof payload.userId !== 'string') {
        const error = new Error('Invalid media token');
        error.code = 'TOKEN_INVALID';
        throw error;
      }
      return { waterTestId: payload.waterTestId, userId: payload.userId };
    },
  };
}
