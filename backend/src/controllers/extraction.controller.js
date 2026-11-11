import { getCourse } from '../config/courses.js';
import { ExtractionError } from '../services/extraction-errors.js';
import { normalizeExtraction } from '../services/extraction-normalizer.js';
import { validatePdfBuffer } from '../services/pdf-validator.js';

export const extractSchedules = ({ extractionProvider, config }) => async (request, response, next) => {
  try {
    const course = getCourse(request.body?.course);
    if (!course) throw new ExtractionError('COURSE_INVALID', 'Selecione um curso válido.', 400);
    if (!request.file) throw new ExtractionError('PDF_REQUIRED', 'Envie um arquivo PDF para extração.', 400);
    const pdf = await validatePdfBuffer(request.file.buffer, {
      fileName: request.file.originalname,
      mimeType: request.file.mimetype,
      maxSizeMb: config.pdfMaxSizeMb,
      maxPages: config.pdfMaxPages,
    });
    let calibration = null;
    if (request.body?.calibration) {
      try { calibration = JSON.parse(request.body.calibration); } catch { throw new ExtractionError('CALIBRATION_INVALID', 'A calibração enviada não é válida.', 400); }
    }
    const extractionPromise = extractionProvider.extract({ buffer: request.file.buffer, fileName: pdf.fileName, course, pageCount: pdf.pageCount, calibration });
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new ExtractionError('EXTRACTION_TIMEOUT', 'O processamento excedeu o tempo limite.', 504)), config.extractionTimeoutMs); });
    let extracted;
    try { extracted = await Promise.race([extractionPromise, timeout]); } finally { clearTimeout(timer); }
    response.json(normalizeExtraction({ extracted, courseName: course.name, fileName: pdf.fileName, pageCount: pdf.pageCount }));
  } catch (error) {
    next(error);
  }
};
