import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRequireAuth } from './middleware/authMiddleware.js';
import { requestContext } from './middleware/requestContext.js';
import createHealthRoutes from './routes/healthRoutes.js';
import createAuthRoutes from './routes/authRoutes.js';
import createUserRoutes from './routes/userRoutes.js';
import createAnalysisRoutes from './routes/analysisRoutes.js';
import createWaterTestRoutes from './routes/waterTestRoutes.js';
import createMapRoutes from './routes/mapRoutes.js';
import createMediaRoutes from './routes/mediaRoutes.js';
import createAccountRoutes from './routes/accountRoutes.js';

function corsOptions() {
  const origins = env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.includes('*')) return { origin: true };
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS policy.'));
    },
  };
}

export function createApp({ authService, authTokenService, userService, waterAnalysisService, waterTestService, mapService, guestLifecycleService, accountService, healthCheck } = {}) {
  const app = express();
  const needsAuthentication = Boolean(authService || userService || waterAnalysisService || waterTestService || mapService);
  if (needsAuthentication && !authTokenService) {
    throw new Error('authTokenService is required when protected AQUILITY API services are configured.');
  }
  const requireAuth = authTokenService ? createRequireAuth(authTokenService, userService) : null;

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/health', createHealthRoutes({ healthCheck }));
  if (authService) {
    const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } } });
    app.use('/api/auth', loginLimiter, createAuthRoutes({ authService, authTokenService, guestLifecycleService, requireAuth }));
  }
  if (authService && userService) {
    app.use('/api/users/:id', requireAuth);
    app.use('/api/users', createUserRoutes({ authService, userService, authTokenService, accountService }));
  }
  if (accountService) {
    app.use('/api/account', requireAuth, createAccountRoutes({ accountService }));
  }
  if (waterAnalysisService) {
    const analysisLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many analysis requests. Please try again later.' } } });
    app.use('/api/analyze-water', requireAuth, analysisLimiter, createAnalysisRoutes({ waterAnalysisService }));
  }
  if (waterTestService) {
    app.use('/api/water-tests/:id/image', createMediaRoutes({ waterTestService, authTokenService, userService }));
    app.use('/api/water-tests', requireAuth, createWaterTestRoutes({ waterTestService, authTokenService }));
  }
  if (mapService) {
    app.use('/api/map-markers', requireAuth, createMapRoutes({ mapService }));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
