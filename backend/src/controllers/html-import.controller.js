import { importHtmlSchedules } from '../services/html-schedule-importer.js';

export const importHtml = ({ config }) => (request, response, next) => {
  try {
    const result = importHtmlSchedules({
      buffer: request.file?.buffer,
      fileName: request.file?.originalname,
      mimeType: request.file?.mimetype,
      maxSizeMb: config.htmlMaxSizeMb,
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
};
