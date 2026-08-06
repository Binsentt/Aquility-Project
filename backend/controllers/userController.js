import { requireAuthenticatedUser } from '../middleware/authMiddleware.js';
import { validateAccountType, validatePassword, validateProfile } from '../utils/validation.js';

export function createUserController({ authService, userService, authTokenService, accountService = null }) {
  return {
    async create(req, res, next) {
      try {
        const payload = req.body || {};
        const accountType = validateAccountType(payload.accountType);
        const profile = validateProfile(payload, { requireEmail: accountType !== 'guest' });
        const user = accountType === 'guest'
          ? await userService.createGuest(profile)
          : await authService.register({ ...profile, password: validatePassword(payload.password, { required: true }) });
        res.status(201).json({ user, token: authTokenService.issueAccessToken(user) });
      } catch (error) {
        next(error);
      }
    },
    async getById(req, res, next) {
      try {
        requireAuthenticatedUser(req, req.params.id);
        res.json({ user: await userService.getById(req.params.id) });
      } catch (error) {
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        requireAuthenticatedUser(req, req.params.id);
        res.json({ user: await userService.update(req.params.id, validateProfile(req.body, { requireEmail: false })) });
      } catch (error) {
        next(error);
      }
    },
    async remove(req, res, next) {
      try {
        requireAuthenticatedUser(req, req.params.id);
        if (!accountService) {
          throw new Error('accountService is required for account deletion.');
        }
        await accountService.removeCurrent({ userId: req.auth.userId, password: req.body?.password });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
