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
};
