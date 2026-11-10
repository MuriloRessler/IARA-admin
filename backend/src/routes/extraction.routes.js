import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { extractSchedules } from '../controllers/extraction.controller.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';
import { ExtractionError } from '../services/extraction-errors.js';
import { createOpenAiExtractionProvider } from '../services/openai-extraction-provider.js';

export const createExtractionRouter = (options = {}) => {
  const suppliedConfig = options.config || {};
  const config = {
    ...env,
    ...suppliedConfig,
    pdfMaxSizeMb: Number(suppliedConfig.pdfMaxSizeMb) || env.pdfMaxSizeMb,
    pdfMaxPages: Number(suppliedConfig.pdfMaxPages) || env.pdfMaxPages,
    extractionTimeoutMs: Number(suppliedConfig.extractionTimeoutMs) || env.extractionTimeoutMs,
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.pdfMaxSizeMb * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        callback(new ExtractionError('PDF_EXTENSION_INVALID', 'Envie um arquivo com extensão .pdf.', 415));
        return;
      }
      if (file.mimetype && !['application/pdf', 'application/octet-stream'].includes(file.mimetype)) {
        callback(new ExtractionError('PDF_MIME_INVALID', 'O tipo MIME informado não é application/pdf.', 415));
        return;
      }
      callback(null, true);
    },
  });
  const router = Router();
  router.post('/extract', createAdminAuthMiddleware(options), upload.single('file'), extractSchedules({
    extractionProvider: options.extractionProvider || createOpenAiExtractionProvider({ config }),
    config,
  }));
  return router;
};
