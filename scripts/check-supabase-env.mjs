import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', url);
console.log('SUPABASE_ANON_KEY exists:', Boolean(key));
console.log('SUPABASE_ANON_KEY length:', key?.length);
console.log('SUPABASE_ANON_KEY starts with:', key?.slice(0, 12));
console.log('SUPABASE_ANON_KEY ends with:', key?.slice(-8));