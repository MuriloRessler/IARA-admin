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
    const extracted = await extractionProvider.extract({ buffer: request.file.buffer, fileName: pdf.fileName, course, pageCount: pdf.pageCount });
    response.json(normalizeExtraction({ extracted, courseName: course.name, fileName: pdf.fileName, pageCount: pdf.pageCount }));
  } catch (error) {
    next(error);
  }
};
