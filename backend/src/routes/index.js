import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { createExtractionRouter } from './extraction.routes.js';
import { createHtmlImportRouter } from './html-import.routes.js';

export const createApiRouter = (options = {}) => {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(options));
  router.use('/schedules', createExtractionRouter(options));
  router.use('/schedules', createHtmlImportRouter(options));
  return router;
};

export const apiRouter = createApiRouter();
