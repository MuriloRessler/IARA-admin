import { Router } from 'express';
import { env } from '../config/env.js';
import { createPublicationController } from '../controllers/publication.controller.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';
import { supabaseAdmin } from '../config/supabase.js';
import { createPublicationRepository } from '../services/publication-repository.js';

export const createPublicationRouter = (options = {}) => {
  const config = { ...env, ...(options.config || {}) };
  const repository = options.publicationRepository || createPublicationRepository({
    client: options.supabaseAdminClient || supabaseAdmin,
    config,
  });
  const controller = createPublicationController({ repository });
  const router = Router();
  router.get('/backup', createAdminAuthMiddleware(options), controller.backup);
  router.post('/preview', createAdminAuthMiddleware(options), controller.preview);
  router.post('/publish', createAdminAuthMiddleware(options), controller.publish);
  return router;
};
