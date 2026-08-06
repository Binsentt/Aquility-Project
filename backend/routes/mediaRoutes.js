import { Router } from 'express';
import { createMediaController } from '../controllers/mediaController.js';

export default function createMediaRoutes({ waterTestService, authTokenService, userService }) {
  const router = Router({ mergeParams: true });
  const controller = createMediaController({ waterTestService, authTokenService, userService });
  router.get('/', controller.getImage);
  return router;
}
