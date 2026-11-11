import 'dotenv/config';

const parseAllowedOrigins = (value) => value
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT) || 3001,
  allowedOrigins: parseAllowedOrigins(process.env.FRONTEND_URL || 'http://localhost:5173'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
  adminUserId: process.env.ADMIN_USER_ID || '',
  publicationEnabled: process.env.PUBLICATION_ENABLED === 'true',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  pdfMaxSizeMb: Number(process.env.PDF_MAX_SIZE_MB) || 20,
  pdfMaxPages: Number(process.env.PDF_MAX_PAGES) || 30,
  extractionTimeoutMs: Number(process.env.EXTRACTION_TIMEOUT_MS) || 120000,
  htmlMaxSizeMb: Number(process.env.HTML_MAX_SIZE_MB) || 10,
  extractionEngine: process.env.EXTRACTION_ENGINE || 'local',
  pdfRenderScale: Number(process.env.PDF_RENDER_SCALE) || 1.5,
  ocrLanguages: process.env.OCR_LANGUAGES || 'por+eng',
  ocrCachePath: process.env.OCR_CACHE_PATH || '',
};
