import { Router } from 'express';
import { createWaterAnalysisController } from '../controllers/waterAnalysisController.js';
import { uploadWaterImage } from '../middleware/uploadMiddleware.js';

export default function createAnalysisRoutes({ waterAnalysisService }) {
  const router = Router();
  const controller = createWaterAnalysisController({ waterAnalysisService });
  router.post('/', uploadWaterImage, controller.analyze);
  return router;
}
