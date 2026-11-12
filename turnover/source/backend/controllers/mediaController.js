import { access } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';
import { assertUuid } from '../utils/validation.js';

function getBearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '');
  return match?.[1] || null;
}

function tokenError(error) {
  const code = error?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
  return new HttpError(401, code, code === 'TOKEN_EXPIRED' ? 'This image link has expired. Refresh the water-test record and try again.' : 'The image link is invalid.');
}

function imageContentType(filename) {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function createMediaController({ waterTestService, authTokenService, userService = null }) {
  return {
    async getImage(req, res, next) {
      try {
        const waterTestId = assertUuid(req.params.id, 'Water test ID');
        const signedToken = typeof req.query.token === 'string' ? req.query.token : null;
        let userId;

        if (signedToken) {
          let claims;
          try {
            claims = authTokenService.verifyMediaToken(signedToken);
          } catch (error) {
            throw tokenError(error);
          }
          if (claims.waterTestId !== waterTestId) {
            throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
          }
          userId = claims.userId;
        } else {
          const bearerToken = getBearerToken(req);
          if (!bearerToken) throw new HttpError(401, 'AUTH_REQUIRED', 'A valid bearer token is required.');
          try {
            userId = authTokenService.verifyAccessToken(bearerToken).userId;
          } catch (error) {
            throw tokenError(error);
          }
        }

        if (userService?.requireActiveSession) {
          const activeUser = await userService.requireActiveSession(userId);
          if (!activeUser) {
            throw new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active. Please sign in again.');
          }
        }

        const waterTest = await waterTestService.getById(waterTestId, userId);
        const filename = basename(waterTest.imagePath || '');
        if (!filename || filename !== waterTest.imagePath?.replace(/^\/uploads\//, '')) {
          throw new HttpError(404, 'IMAGE_NOT_FOUND', 'The captured water-test image is unavailable.');
        }
        const imageFile = resolve(process.cwd(), env.uploadDir, filename);
        try {
          await access(imageFile);
        } catch {
          throw new HttpError(404, 'IMAGE_NOT_FOUND', 'The captured water-test image is unavailable.');
        }

        res.setHeader('Cache-Control', 'private, max-age=300');
        res.type(imageContentType(filename));
        res.sendFile(imageFile, (error) => {
          if (error && !res.headersSent) next(error);
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
