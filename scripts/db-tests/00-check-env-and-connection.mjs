import { assertEnv } from './config.mjs';
import {
  createAnonClient,
  expectSuccess,
  runStage,
} from './test-utils.mjs';

const STAGE = '00 check env and connection';

await runStage(STAGE, async () => {
  assertEnv();
  console.log('✅ SUPABASE_URL is present and hosted URL format is valid');
  console.log('✅ SUPABASE_ANON_KEY is present');

  const client = createAnonClient();
  await expectSuccess(
    STAGE,
    'connect with anon client',
    client.auth.getSession(),
    'Check SUPABASE_URL, SUPABASE_ANON_KEY, and project availability.'
  );
});
