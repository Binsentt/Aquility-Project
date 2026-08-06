import { HttpError } from '../middleware/errorHandler.js';

export function createWaterAnalysisController({ waterAnalysisService }) {
  return {
    async analyze(req, res, next) {
      try {
        if (!req.file) {
          throw new HttpError(400, 'IMAGE_REQUIRED', 'A captured water-test image is required.');
        }
        const analysis = await waterAnalysisService.analyze({ file: req.file, metadata: req.body, authenticatedUserId: req.auth.userId });
        res.status(201).json(analysis);
      } catch (error) {
        next(error);
      }
    },
  };
}
