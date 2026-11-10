import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';

export const createApiRouter = (options = {}) => {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(options));
  return router;
};

export const apiRouter = createApiRouter();
