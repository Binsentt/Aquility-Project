import { HttpError } from '../middleware/errorHandler.js';

export function createWaterAnalysisController({ waterAnalysisService, debugLogger = null }) {
  return {
    async analyze(req, res, next) {
      try {
        if (!req.file) {
          throw new HttpError(400, 'IMAGE_REQUIRED', 'A captured water-test image is required.');
        }
        const analysis = await waterAnalysisService.analyze({ file: req.file, metadata: req.body, authenticatedUserId: req.auth.userId });
        debugLogger?.('response-sent', { requestId: req.requestId || null, status: 201, fileReceived: true });
        res.status(201).json(analysis);
      } catch (error) {
        next(error);
      }
    },
  };
}
