export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_HTML_SIZE_BYTES = 10 * 1024 * 1024;

export const validatePdfFile = (file) => {
  if (!file) return { valid: false, error: 'Selecione um arquivo PDF.' };
  const hasPdfExtension = file.name?.toLowerCase().endsWith('.pdf');
  if (!hasPdfExtension || (file.type && file.type !== 'application/pdf')) {
    return { valid: false, error: 'Selecione um arquivo com extensão e tipo PDF.' };
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return { valid: false, error: 'O PDF excede o limite de 20 MB.' };
  }
  return { valid: true, error: null };
};

export const validateImportFile = (file) => {
  if (!file) return { valid: false, error: 'Selecione um arquivo PDF ou HTML.' };
  const name = file.name?.toLowerCase() || '';
  const isPdf = name.endsWith('.pdf');
  const isHtml = name.endsWith('.html') || name.endsWith('.htm');
  if (!isPdf && !isHtml) return { valid: false, error: 'Selecione um arquivo com extensão .pdf, .html ou .htm.' };
  if (isPdf && file.type && file.type !== 'application/pdf') return { valid: false, error: 'O tipo MIME informado não é PDF.' };
  if (isHtml && file.type && !['text/html', 'application/xhtml+xml', 'application/octet-stream'].includes(file.type)) return { valid: false, error: 'O tipo MIME informado não é HTML.' };
  const limit = isHtml ? MAX_HTML_SIZE_BYTES : MAX_PDF_SIZE_BYTES;
  if (file.size > limit) return { valid: false, error: `O arquivo excede o limite de ${isHtml ? 10 : 20} MB.` };
  return { valid: true, error: null };
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
