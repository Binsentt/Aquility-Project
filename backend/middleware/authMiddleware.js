import { HttpError } from './errorHandler.js';

function parseBearerToken(value) {
  const match = /^Bearer\s+(.+)$/i.exec(value || '');
  return match?.[1] || null;
}

export function createRequireAuth(authTokenService, userService = null) {
  return async (req, res, next) => {
    const token = parseBearerToken(req.get('Authorization'));
    if (!token) {
      next(new HttpError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.'));
      return;
    }

    try {
      const claims = authTokenService.verifyAccessToken(token);
      const authenticatedUser = userService?.requireActiveSession
        ? await userService.requireActiveSession(claims.userId)
        : null;
      if (userService?.requireActiveSession && !authenticatedUser) {
        throw new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active. Please sign in again.');
      }
      req.auth = { ...claims, user: authenticatedUser };
      next();
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      const code = error?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      next(new HttpError(401, code, code === 'TOKEN_EXPIRED' ? 'Your session has expired. Please sign in again.' : 'The bearer token is invalid.'));
    }
  };
}

export function requireAuthenticatedUser(req, userId) {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.');
  }
  if (req.auth.userId !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
  }
}
