import { Router } from 'express';
import { createWaterTestController } from '../controllers/waterTestController.js';

export default function createWaterTestRoutes({ waterTestService, authTokenService }) {
  const router = Router();
  const controller = createWaterTestController({ waterTestService });
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
