import { Router } from 'express';
import { createAccountController } from '../controllers/accountController.js';

export default function createAccountRoutes({ accountService }) {
  const router = Router();
  const controller = createAccountController({ accountService });
  router.delete('/', controller.removeCurrent);
  return router;
}
