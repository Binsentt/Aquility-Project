import { Router } from 'express';

export default function createHealthRoutes({ healthCheck = null } = {}) {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!healthCheck) {
      res.json({ status: 'ok', service: 'aquility-api' });
      return;
    }

    try {
      await healthCheck();
      res.json({ status: 'ok', service: 'aquility-api', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'unavailable', service: 'aquility-api', database: 'unavailable' });
    }
  });

  return router;
}
