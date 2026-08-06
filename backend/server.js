import { createApp } from './app.js';
import { env } from './config/env.js';
import { createPool } from './database/pool.js';
import { createUserModel } from './models/userModel.js';
import { createAuthService } from './services/authService.js';
import { createUserService } from './services/userService.js';
import { createWaterTestModel } from './models/waterTestModel.js';
import { createColorAnalysisEngine } from './services/colorAnalysisEngine.js';
import { createWaterAnalysisService } from './services/waterAnalysisService.js';
import { createWaterTestService } from './services/waterTestService.js';
import { createAuthTokenService } from './services/authTokenService.js';
import { createMapService } from './services/mapService.js';
import { createGuestLifecycleService } from './services/guestLifecycleService.js';
import { createAccountService } from './services/accountService.js';
import { createUploadDeletionService } from './services/uploadDeletionService.js';

const pool = createPool();
const userModel = createUserModel(pool);
const waterTestModel = createWaterTestModel(pool);
const authTokenService = createAuthTokenService();
const guestLifecycleService = createGuestLifecycleService({ userModel, guestArchiveDays: env.guestArchiveDays });
const uploadDeletionService = createUploadDeletionService();
const healthCheck = () => pool.query('SELECT 1');
const app = createApp({
  authService: createAuthService({ userModel }),
  authTokenService,
  userService: createUserService({ userModel, guestArchiveDays: env.guestArchiveDays }),
  guestLifecycleService,
  waterAnalysisService: createWaterAnalysisService({
    colorAnalysisEngine: createColorAnalysisEngine(),
    waterTestModel,
    userModel,
    authTokenService,
  }),
  waterTestService: createWaterTestService({ waterTestModel, pool, uploadDeletionService }),
  accountService: createAccountService({ pool, userModel, waterTestModel, uploadDeletionService }),
  mapService: createMapService({ waterTestModel }),
  healthCheck,
});

let server = null;
let guestArchiveTimer = null;

async function archiveExpiredGuests() {
  try {
    await guestLifecycleService.archiveExpiredGuests();
  } catch {
    console.error(JSON.stringify({ event: 'guest-archive-job-failed' }));
  }
}

async function shutdown(signal) {
  if (guestArchiveTimer) clearInterval(guestArchiveTimer);
  if (!server) {
    await pool.end().catch(() => undefined);
    return;
  }
  server.close(async () => {
    await pool.end().catch(() => undefined);
    console.log(`AQUILITY API stopped after ${signal}.`);
  });
}

async function start() {
  try {
    await healthCheck();
    await archiveExpiredGuests();
    server = app.listen(env.port, () => {
      console.log(`AQUILITY API listening on port ${env.port}`);
    });
    guestArchiveTimer = setInterval(archiveExpiredGuests, env.guestArchiveIntervalMs);
    guestArchiveTimer.unref?.();
    process.once('SIGINT', () => { shutdown('SIGINT'); });
    process.once('SIGTERM', () => { shutdown('SIGTERM'); });
  } catch {
    console.error(JSON.stringify({ event: 'database-startup-check-failed' }));
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  }
}

start();
