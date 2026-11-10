export class ExtractionError extends Error {
  constructor(code, message, statusCode = 422, details = {}) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.expose = true;
  }
}
