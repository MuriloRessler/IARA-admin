import { access, constants, mkdir } from 'node:fs/promises';
import { createWorker } from 'tesseract.js';
import { ExtractionError } from './extraction-errors.js';

export const parseCellText = (text) => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { disciplina: '', professor: '', sala: '', estado: 'nao_reconhecido', incertezas: ['OCR não encontrou texto.'] };
  const salaMatch = normalized.match(/\b(?:sala|sl\.?)[\s:.-]*([A-Z0-9-]+)/i);
  const withoutRoom = salaMatch ? normalized.replace(salaMatch[0], '').trim() : normalized;
  const teacherMatch = withoutRoom.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (teacherMatch) return { disciplina: teacherMatch[1].trim(), professor: teacherMatch[2].trim(), sala: salaMatch?.[1] || '', estado: 'reconhecido', incertezas: [] };
  return { disciplina: withoutRoom, professor: '', sala: salaMatch?.[1] || '', estado: 'parcial', incertezas: ['Professor não foi separado com segurança.'] };
};

const noop = () => {};

const createInitializationError = (cause) => {
  const error = new ExtractionError('OCR_UNAVAILABLE', 'O OCR local não pôde ser inicializado. Verifique os dados de idioma e o diretório de cache.', 503, { cause: cause?.message || String(cause) });
  error.isOcrInitialization = true;
  return error;
};

export const createOcrEngine = ({ language = 'por+eng', cachePath, logger, errorHandler } = {}) => {
  const progressLogger = typeof logger === 'function' ? logger : noop;
  const externalErrorHandler = typeof errorHandler === 'function' ? errorHandler : noop;
  let workerPromise;
  let workerReference;
  let rejectInitialization;

  const reportWorkerError = (cause) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (rejectInitialization) rejectInitialization(error);
    try { externalErrorHandler(error); } catch (_handlerError) { /* A callback externo não pode derrubar o processo. */ }
  };

  const getWorker = () => {
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      const initializationFailure = new Promise((_, reject) => { rejectInitialization = reject; });
      const options = { logger: progressLogger, errorHandler: reportWorkerError };
      if (cachePath) options.cachePath = cachePath;
      try {
        if (cachePath) {
          await mkdir(cachePath, { recursive: true });
          await access(cachePath, constants.W_OK);
        }
        workerReference = await Promise.race([createWorker(language, 1, options), initializationFailure]);
        return workerReference;
      } catch (error) {
        workerPromise = null;
        throw createInitializationError(error);
      } finally {
        rejectInitialization = null;
      }
    })();
    return workerPromise;
  };

  return {
    async recognize(buffer) {
      const worker = await getWorker();
      const result = await worker.recognize(buffer);
      return { ...parseCellText(result.data?.text || ''), textoOriginal: result.data?.text || '' };
    },
    async close() {
      const promise = workerPromise;
      workerPromise = null;
      try {
        const worker = workerReference || (promise && await promise);
        if (worker) await worker.terminate();
      } catch (_error) {
        // A worker that failed during initialization has no usable handle to terminate.
      }
      workerReference = null;
      workerPromise = null;
    },
  };
};
