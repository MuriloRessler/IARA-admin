import { PDFDocument } from 'pdf-lib';
import { ExtractionError } from './extraction-errors.js';

const PDF_SIGNATURE = Buffer.from('%PDF-');

export const validatePdfBuffer = async (buffer, {
  fileName = 'horarios.pdf',
  mimeType = 'application/pdf',
  maxSizeMb = 20,
  maxPages = 30,
} = {}) => {
  if (!buffer?.length) throw new ExtractionError('PDF_EMPTY', 'O arquivo PDF está vazio.', 400);
  if (!fileName.toLowerCase().endsWith('.pdf')) throw new ExtractionError('PDF_EXTENSION_INVALID', 'Envie um arquivo com extensão .pdf.', 415);
  if (mimeType && !['application/pdf', 'application/octet-stream'].includes(mimeType)) {
    throw new ExtractionError('PDF_MIME_INVALID', 'O tipo MIME informado não é application/pdf.', 415);
  }
  if (buffer.length > maxSizeMb * 1024 * 1024) {
    throw new ExtractionError('PDF_TOO_LARGE', `O PDF excede o limite de ${maxSizeMb} MB.`, 413);
  }
  if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new ExtractionError('PDF_SIGNATURE_INVALID', 'O conteúdo enviado não é um PDF válido.', 415);
  }

  let document;
  try {
    document = await PDFDocument.load(buffer, { ignoreEncryption: false });
  } catch {
    throw new ExtractionError('PDF_UNREADABLE', 'Não foi possível ler o PDF enviado.', 422);
  }
  const pageCount = document.getPageCount();
  if (!pageCount) throw new ExtractionError('PDF_EMPTY_DOCUMENT', 'O PDF não possui páginas.', 422);
  if (pageCount > maxPages) throw new ExtractionError('PDF_TOO_MANY_PAGES', `O PDF excede o limite de ${maxPages} páginas.`, 413);
  return { fileName, mimeType: 'application/pdf', sizeBytes: buffer.length, pageCount };
};
