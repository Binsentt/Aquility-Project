import { Router } from 'express';
import { createWaterAnalysisController } from '../controllers/waterAnalysisController.js';
import { uploadWaterImage } from '../middleware/uploadMiddleware.js';
import { sha256File } from '../utils/uploadDiagnostics.js';

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
    if (!debugLogger) return next();
    sha256File(req.file?.path).then((sha256) => {
      debugLogger('multer-file-received', {
        requestId: req.requestId || null,
        fileReceived: Boolean(req.file),
        mimeType: req.file?.mimetype || null,
        size: Number.isFinite(req.file?.size) ? req.file.size : null,
        sha256,
      });
      next();
    }).catch(() => next());
  };
  router.post('/', traceRoute, traceMulter, uploadWaterImage, traceFile, controller.analyze);
  return router;
}
