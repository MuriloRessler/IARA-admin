import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { extractSchedules } from '../controllers/extraction.controller.js';
import { createAdminAuthMiddleware } from '../middlewares/authenticate-admin.js';
import { ExtractionError } from '../services/extraction-errors.js';
import { createOpenAiExtractionProvider } from '../services/openai-extraction-provider.js';
import { createLocalExtractionProvider } from '../services/local-extraction-provider.js';
import { cropImage } from '../services/image-processing.js';
import { inspectPdf } from '../services/pdf-renderer.js';
import { validatePdfBuffer } from '../services/pdf-validator.js';

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
  const defaultProvider = config.extractionEngine === 'openai'
    ? createOpenAiExtractionProvider({ config })
    : createLocalExtractionProvider({ config });
  router.post('/cell-preview', createAdminAuthMiddleware(options), upload.single('file'), async (request, response, next) => {
    try {
      if (!request.file) throw new ExtractionError('PDF_REQUIRED', 'Envie o PDF para visualizar a célula.', 400);
      const pdf = await validatePdfBuffer(request.file.buffer, { fileName: request.file.originalname, mimeType: request.file.mimetype, maxSizeMb: config.pdfMaxSizeMb, maxPages: config.pdfMaxPages });
      const pageNumber = Number(request.body?.page);
      const bbox = JSON.parse(request.body?.bbox || '{}');
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isFinite(bbox.left) || !Number.isFinite(bbox.top) || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) throw new ExtractionError('CELL_PREVIEW_INVALID', 'A região da célula é inválida.', 400);
      const inspected = await inspectPdf(request.file.buffer, { maxPages: pdf.pageCount, renderScale: config.pdfRenderScale });
      const page = inspected.pages[pageNumber - 1];
      if (!page) throw new ExtractionError('CELL_PREVIEW_PAGE_INVALID', 'A página da célula não existe no PDF.', 400);
      const image = await cropImage(page.imageBuffer, { left: bbox.left * (page.renderWidth / page.width), top: bbox.top * (page.renderHeight / page.height), width: bbox.width * (page.renderWidth / page.width), height: bbox.height * (page.renderHeight / page.height) });
      response.type('png').send(image);
    } catch (error) { next(error); }
  });
  router.post('/extract', createAdminAuthMiddleware(options), upload.single('file'), extractSchedules({
    extractionProvider: options.extractionProvider || defaultProvider,
    config,
  }));
  return router;
};
