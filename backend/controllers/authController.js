import { HttpError } from '../middleware/errorHandler.js';
import { validateEmail } from '../utils/validation.js';

export function createAuthController({ authService, authTokenService, guestLifecycleService }) {
  return {
    async login(req, res, next) {
      try {
        const { email, password } = req.body || {};
        if (!email || !password) {
          throw new HttpError(400, 'CREDENTIALS_REQUIRED', 'Email and password are required.');
        }
        if (typeof password !== 'string') {
          throw new HttpError(400, 'CREDENTIALS_REQUIRED', 'Email and password are required.');
        }
        const user = await authService.login({ email: validateEmail(email, { required: true }), password });
        res.json({ user, token: authTokenService.issueAccessToken(user) });
      } catch (error) {
        next(error);
      }
    },
    async logout(req, res, next) {
      try {
        await guestLifecycleService?.archiveOnLogout(req.auth?.user);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
