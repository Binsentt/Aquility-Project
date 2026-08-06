import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { HttpError } from '../middleware/errorHandler.js';
import { assertUuid, validateCapturedAt, validateCoordinates, validateOptionalText } from '../utils/validation.js';

export function createWaterTestController({ waterTestService, authTokenService }) {
  return {
    async list(req, res, next) {
      try {
        if (req.query.userId && req.query.userId !== req.auth.userId) {
          throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
        }
        const items = await waterTestService.list({ userId: req.auth.userId });
        res.json({ items: items.map((item) => serializeWaterTest(item, authTokenService)) });
      } catch (error) {
        next(error);
      }
    },
    async getById(req, res, next) {
      try {
        const waterTest = await waterTestService.getById(assertUuid(req.params.id, 'Water test ID'), req.auth.userId);
        res.json(serializeWaterTest(waterTest, authTokenService));
      } catch (error) {
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        const id = assertUuid(req.params.id, 'Water test ID');
        const coordinates = validateCoordinates(req.body?.gpsLatitude, req.body?.gpsLongitude);
        const capturedAt = validateCapturedAt(req.body?.capturedAt, { required: false });
        const waterTest = await waterTestService.update(id, req.auth.userId, {
          ...coordinates,
          capturedAt,
          barangay: validateOptionalText(req.body?.barangay, 'Barangay', 120),
          municipality: validateOptionalText(req.body?.municipality, 'Municipality', 120),
        });
        res.json(serializeWaterTest(waterTest, authTokenService));
      } catch (error) {
        next(error);
      }
    },
    async remove(req, res, next) {
      try {
        await waterTestService.remove(assertUuid(req.params.id, 'Water test ID'), req.auth.userId);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
