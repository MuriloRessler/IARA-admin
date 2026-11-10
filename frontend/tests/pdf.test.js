import { describe, expect, it } from 'vitest';
import { MAX_PDF_SIZE_BYTES, validatePdfFile } from '../src/services/pdf.js';

describe('local PDF validation', () => {
  it('accepts a PDF within the configured limit', () => {
    expect(validatePdfFile({ name: 'horarios.pdf', type: 'application/pdf', size: 1024 })).toEqual({ valid: true, error: null });
  });

  it('rejects invalid extensions, MIME types and oversized files', () => {
    expect(validatePdfFile({ name: 'horarios.docx', type: 'application/pdf', size: 1024 }).valid).toBe(false);
    expect(validatePdfFile({ name: 'horarios.pdf', type: 'text/plain', size: 1024 }).valid).toBe(false);
    expect(validatePdfFile({ name: 'horarios.pdf', type: 'application/pdf', size: MAX_PDF_SIZE_BYTES + 1 }).valid).toBe(false);
  });
});
