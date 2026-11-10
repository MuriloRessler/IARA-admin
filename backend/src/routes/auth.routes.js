import { Router } from 'express';
import { getCurrentAdmin } from '../controllers/auth.controller.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';

export const createAuthRouter = (options = {}) => {
  const router = Router();
  router.get('/me', createAdminAuthMiddleware(options), getCurrentAdmin);
  return router;
};
