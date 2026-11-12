import { Router } from 'express';

export default function createHealthRoutes({ healthCheck = null, manualLocationCheck = null } = {}) {
  const router = Router();

  router.get('/', async (req, res) => {
    if (healthCheck) {
      try {
        await healthCheck();
      } catch {
        res.status(503).json({
          status: 'unavailable',
          service: 'aquility-api',
          database: 'unavailable',
          features: { manualSampleLocation: false },
        });
        return;
      }
    }

    const manualSampleLocation = manualLocationCheck ? await manualLocationCheck() === true : false;
    res.json({
      status: 'ok',
      service: 'aquility-api',
      ...(healthCheck ? { database: 'connected' } : {}),
      features: { manualSampleLocation },
    });
  });

  return router;
}
