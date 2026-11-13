export const MAX_HTML_SIZE_BYTES = 10 * 1024 * 1024;

export const validateHtmlFile = (file) => {
  if (!file) return { valid: false, error: 'Selecione um arquivo HTML.' };
  const name = file.name?.toLowerCase() || '';
  const isHtml = name.endsWith('.html') || name.endsWith('.htm');
  if (!isHtml) return { valid: false, error: 'Selecione um arquivo com extensão .html ou .htm.' };
  if (file.type && !['text/html', 'application/xhtml+xml', 'application/octet-stream'].includes(file.type)) {
    return { valid: false, error: 'O tipo MIME informado não é HTML.' };
  }
  if (file.size > MAX_HTML_SIZE_BYTES) return { valid: false, error: 'O arquivo HTML excede o limite de 10 MB.' };
  return { valid: true, error: null };
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
