import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';

export default function createAuthRoutes({ authService, authTokenService, guestLifecycleService, requireAuth }) {
  const router = Router();
  const controller = createAuthController({ authService, authTokenService, guestLifecycleService });
  router.post('/login', controller.login);
  if (requireAuth) router.post('/logout', requireAuth, controller.logout);
  return router;
}
