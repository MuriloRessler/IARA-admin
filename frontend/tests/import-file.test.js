import { describe, expect, it } from 'vitest';
import { MAX_HTML_SIZE_BYTES, validateHtmlFile } from '../src/services/import-file.js';

describe('structured HTML import validation', () => {
  it('accepts an HTML file within the configured limit', () => {
    expect(validateHtmlFile({ name: 'horarios.html', type: 'text/html', size: 1024 })).toEqual({ valid: true, error: null });
  });

  it('accepts the htm extension and compatible MIME types', () => {
    expect(validateHtmlFile({ name: 'horarios.htm', type: 'application/xhtml+xml', size: 1024 }).valid).toBe(true);
  });

  it('rejects non-HTML files, incompatible MIME types and oversized files', () => {
    expect(validateHtmlFile({ name: 'horarios.docx', type: 'text/html', size: 1024 }).valid).toBe(false);
    expect(validateHtmlFile({ name: 'horarios.html', type: 'application/json', size: 1024 }).valid).toBe(false);
    expect(validateHtmlFile({ name: 'horarios.html', type: 'text/html', size: MAX_HTML_SIZE_BYTES + 1 }).valid).toBe(false);
  });
});
