import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const hasSupabaseConfiguration = Boolean(env.supabaseUrl && env.supabasePublishableKey);
const hasSupabaseAdminConfiguration = Boolean(env.supabaseUrl && env.supabaseSecretKey);

const authOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export const supabase = hasSupabaseConfiguration
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, authOptions)
  : null;

export const supabaseAdmin = hasSupabaseAdminConfiguration
  ? createClient(env.supabaseUrl, env.supabaseSecretKey, authOptions)
  : null;

export { hasSupabaseConfiguration, hasSupabaseAdminConfiguration };
