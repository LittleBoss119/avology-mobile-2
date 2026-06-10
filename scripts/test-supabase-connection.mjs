import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL atau SUPABASE_ANON_KEY belum ada.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data, error } = await supabase.auth.getSession();

if (error) {
  console.error('❌ Supabase connection failed:');
  console.error(error);
  process.exit(1);
}

console.log('✅ Supabase client berhasil konek.');
console.log(data);