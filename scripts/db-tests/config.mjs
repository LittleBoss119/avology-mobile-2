import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const localEnvPath = resolve(process.cwd(), '.env.test.local');

if (existsSync(localEnvPath)) {
  loadDotenv({ path: localEnvPath, override: false });
} else {
  loadDotenv({ override: false });
}

export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
export const TEST_PASSWORD = process.env.DB_TEST_PASSWORD ?? 'AvologyV2-Test-Password-12345';
export const STATE_FILE_PATH = resolve(
  process.cwd(),
  'scripts/db-tests/.db-test-state.local.json'
);

export function assertEnv() {
  const missing = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(', ')}`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL');
  }

  if (!parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('SUPABASE_URL must be a hosted Supabase URL ending with .supabase.co');
  }

  if (!SUPABASE_ANON_KEY.startsWith('ey')) {
    throw new Error('SUPABASE_ANON_KEY does not look like a JWT anon key');
  }
}
