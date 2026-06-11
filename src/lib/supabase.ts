import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const SUPABASE_URL = 'https://qjjnnmrlvkzdefrvkxtr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wAkQAVV0RiLxbb-O10ZYdg_QSPrf-6F';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
