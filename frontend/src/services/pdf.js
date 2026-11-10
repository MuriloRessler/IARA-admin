export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

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

export const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
