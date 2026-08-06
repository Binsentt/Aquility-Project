import { Router } from 'express';
import { createMapController } from '../controllers/mapController.js';

export default function createMapRoutes({ mapService }) {
  const router = Router();
  const controller = createMapController({ mapService });
  router.get('/', controller.list);
  return router;
}
