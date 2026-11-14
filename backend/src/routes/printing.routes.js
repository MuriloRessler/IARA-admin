import { Router } from 'express';
import { env } from '../config/env.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';
import { createPrintingRepository, printingError } from '../services/printing-repository.js';

export function createPrintingRouter(options = {}) {
  const router = Router();
  const repository = options.printingRepository || createPrintingRepository({ client: options.supabaseAdminClient, config: { ...env, ...options.config } });
  router.use(createAdminAuthMiddleware(options));
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.param('id', (request, _response, next, id) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return next(printingError('PRINTING_INVALID_ID', 'Identificador inválido.', 400));
    next();
  });
  router.get('/', async (request, response) => {
    const { status = 'pending', page = '1' } = request.query;
    if (!['pending', 'printed'].includes(status) || !/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) < 1 || Number(page) > 100000) {
      throw printingError('PRINTING_INVALID_FILTER', 'Filtro ou página inválidos.', 400);
    }
    response.json(await repository.list({ printed: status === 'printed', page: Number(page) }));
  });
  router.post('/:id/download', async (request, response) => response.json(await repository.download(request.params.id)));
  router.patch('/:id/printed', async (request, response) => {
    if (request.body?.confirmed !== true) throw printingError('PRINTING_CONFIRMATION_REQUIRED', 'Confirme que o documento foi impresso.', 400);
    response.json(await repository.markPrinted(request.params.id));
  });
  return router;
}
