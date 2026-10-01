import { Router } from 'express';
import { createWaterAnalysisController } from '../controllers/waterAnalysisController.js';
import { uploadWaterImage } from '../middleware/uploadMiddleware.js';

export default function createAnalysisRoutes({ waterAnalysisService, debugLogger = null }) {
  const router = Router();
  const controller = createWaterAnalysisController({ waterAnalysisService, debugLogger });
  const traceRoute = (req, res, next) => {
    debugLogger?.('route-reached', {
      requestId: req.requestId || null,
      contentType: req.get('content-type') || null,
      contentLength: req.get('content-length') || null,
      authenticatedUserPresent: Boolean(req.auth?.userId),
    });
    next();
  };
  const traceMulter = (req, res, next) => {
    debugLogger?.('multer-start', { requestId: req.requestId || null });
    next();
  };
  const traceFile = (req, res, next) => {
    debugLogger?.('multer-file-received', {
      requestId: req.requestId || null,
      fileReceived: Boolean(req.file),
      mimeType: req.file?.mimetype || null,
      size: Number.isFinite(req.file?.size) ? req.file.size : null,
    });
    next();
  };
  router.post('/', traceRoute, traceMulter, uploadWaterImage, traceFile, controller.analyze);
  return router;
}
