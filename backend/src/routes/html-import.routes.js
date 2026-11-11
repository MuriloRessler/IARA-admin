import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { importHtml } from '../controllers/html-import.controller.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';
import { ExtractionError } from '../services/extraction-errors.js';

export const createHtmlImportRouter = (options = {}) => {
  const suppliedConfig = options.config || {};
  const config = {
    ...env,
    ...suppliedConfig,
    htmlMaxSizeMb: Number(suppliedConfig.htmlMaxSizeMb) || env.htmlMaxSizeMb,
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.htmlMaxSizeMb * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!/\.html?$/i.test(file.originalname || '')) {
        callback(new ExtractionError('HTML_EXTENSION_INVALID', 'Envie um arquivo com extensão .html ou .htm.', 415));
        return;
      }
      if (file.mimetype && !['text/html', 'application/xhtml+xml', 'application/octet-stream'].includes(file.mimetype)) {
        callback(new ExtractionError('HTML_MIME_INVALID', 'O tipo MIME informado não é HTML.', 415));
        return;
      }
      callback(null, true);
    },
  });
  const router = Router();
  router.post('/import-html', createAdminAuthMiddleware(options), upload.single('file'), importHtml({ config }));
  return router;
};
