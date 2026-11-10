import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const hasSupabaseConfiguration = Boolean(env.supabaseUrl && env.supabasePublishableKey);

export const supabase = hasSupabaseConfiguration
  ? createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  : null;

export { hasSupabaseConfiguration };
