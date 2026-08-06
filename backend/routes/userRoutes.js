import { Router } from 'express';
import { createUserController } from '../controllers/userController.js';

export default function createUserRoutes({ authService, userService, authTokenService, accountService }) {
  const router = Router();
  const controller = createUserController({ authService, userService, authTokenService, accountService });
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
