import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://kdfcczskpcwhezuoygiz.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkZmNjenNrcGN3aGV6dW95Z2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Mjc1NjIsImV4cCI6MjEwMzUwMzU2Mn0.9ffsQUqEmRr2Vc7AB0ticYp6Qy_KHHlMbvg3q9ATWrM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
