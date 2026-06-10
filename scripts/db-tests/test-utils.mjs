import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  STATE_FILE_PATH,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  TEST_PASSWORD,
} from './config.mjs';

export { TEST_PASSWORD };

export class TestFailure extends Error {
  constructor(stage, operation, message, cause) {
    super(message);
    this.name = 'TestFailure';
    this.stage = stage;
    this.operation = operation;
    this.causeHint = cause;
  }
}

export function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function createSignedInClient(email, password = TEST_PASSWORD) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Auth did not return a user session');
  }

  return { client, user: data.user };
}

export async function createUserWithProfile({ email, fullName, phone }) {
  const client = createAnonClient();
  const signUp = await client.auth.signUp({
    email,
    password: TEST_PASSWORD,
  });

  if (signUp.error) {
    throw new Error(signUp.error.message);
  }

  let user = signUp.data.user;

  if (!signUp.data.session) {
    const signedIn = await client.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });

    if (signedIn.error) {
      throw new Error(
        `${signedIn.error.message}. If email confirmation is enabled, disable it for this test project or pre-confirm the test users.`
      );
    }

    user = signedIn.data.user;
  }

  if (!user) {
    throw new Error('Auth sign up did not return a user');
  }

  const profile = await client
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        phone,
      },
      { onConflict: 'id' }
    )
    .select('id, full_name, phone')
    .single();

  if (profile.error) {
    throw new Error(profile.error.message);
  }

  return { client, user, profile: profile.data };
}

export function uniqueEmail(prefix, runId = makeRunId()) {
  return `${prefix}+${runId}@example.com`;
}

export function makeRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(nextState) {
  mkdirSync(dirname(STATE_FILE_PATH), { recursive: true });
  writeFileSync(STATE_FILE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
}

export function mergeState(patch) {
  const state = { ...loadState(), ...patch };
  saveState(state);
  return state;
}

export function requireState(stage, keys) {
  const state = loadState();
  const missing = keys.filter((key) => state[key] === undefined || state[key] === null);

  if (missing.length > 0) {
    throw new TestFailure(
      stage,
      'load test state',
      `Missing state keys: ${missing.join(', ')}`,
      'Run scripts/db-tests/01-auth-profile-membership.test.mjs first, or run npm run test:db:all.'
    );
  }

  return state;
}

export async function runStage(stage, fn) {
  console.log(`\n${stage}`);
  console.log('-'.repeat(stage.length));

  try {
    await fn();
    console.log(`✅ ${stage} passed`);
  } catch (error) {
    printFailure(stage, error);
    process.exitCode = 1;
  }
}

export function printFailure(stage, error) {
  const operation = error instanceof TestFailure ? error.operation : 'unexpected error';
  const message = error?.message ?? String(error);
  const cause = error instanceof TestFailure
    ? error.causeHint
    : 'Check database migrations, RLS policies, RPC signatures, and SUPABASE_URL/SUPABASE_ANON_KEY.';

  console.error(`❌ ${stage} failed`);
  console.error(`Stage: ${stage}`);
  console.error(`Operation: ${operation}`);
  console.error(`Error: ${message}`);
  console.error(`Possible cause: ${cause}`);
}

export function pass(message) {
  console.log(`✅ ${message}`);
}

export function fail(stage, operation, message, cause) {
  throw new TestFailure(stage, operation, message, cause);
}

export function assertCondition(stage, operation, condition, message, cause) {
  if (!condition) {
    fail(stage, operation, message, cause);
  }

  pass(operation);
}

export function assertEqual(stage, operation, actual, expected, cause) {
  if (actual !== expected) {
    fail(stage, operation, `Expected ${expected}, got ${actual}`, cause);
  }

  pass(operation);
}

export async function expectSuccess(stage, operation, promise, cause) {
  const result = await promise;

  if (result.error) {
    fail(stage, operation, result.error.message, cause);
  }

  pass(operation);
  return result.data;
}

export async function expectFailure(stage, operation, promise, cause) {
  const result = await promise;

  if (!result.error) {
    fail(stage, operation, 'Operation unexpectedly succeeded', cause);
  }

  pass(operation);
  return result.error;
}

export async function expectZeroRows(stage, operation, promise, cause) {
  const result = await promise;

  if (result.error) {
    fail(stage, operation, result.error.message, cause);
  }

  if (!Array.isArray(result.data) || result.data.length !== 0) {
    fail(stage, operation, `Expected 0 visible rows, got ${result.data?.length ?? 'unknown'}`, cause);
  }

  pass(operation);
  return result.data;
}

export async function expectDeniedOrNoRows(stage, operation, promise, cause) {
  const result = await promise;

  if (result.error) {
    pass(operation);
    return result.error;
  }

  const rowCount = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
  if (rowCount === 0) {
    pass(operation);
    return result.data;
  }

  fail(stage, operation, `Expected denial or 0 rows, got ${rowCount}`, cause);
}

export async function getSingle(stage, operation, promise, cause) {
  const data = await expectSuccess(stage, operation, promise, cause);

  if (!data) {
    fail(stage, operation, 'Expected one row but got no data', cause);
  }

  return data;
}

export function firstRpcRow(data) {
  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
}

export async function joinWorkerToFarm(stage, workerClient, joinCode) {
  return expectSuccess(
    stage,
    'worker requests farm join',
    workerClient.rpc('request_join_farm', { p_join_code: joinCode }),
    'Check request_join_farm(p_join_code text), farm join_code, and worker profile existence.'
  );
}

export async function approveWorker(stage, ownerClient, membershipId) {
  await expectSuccess(
    stage,
    'owner approves worker',
    ownerClient.rpc('approve_worker', { p_farm_member_id: membershipId }),
    'Check approve_worker(p_farm_member_id uuid) and active owner membership.'
  );
}

export async function createWorkerAndJoin({ stage, runId, label, joinCode, fullName, phone }) {
  const email = uniqueEmail(label, runId);
  const { client, user } = await createUserWithProfile({
    email,
    fullName,
    phone,
  });
  const membershipId = await joinWorkerToFarm(stage, client, joinCode);

  return {
    client,
    email,
    userId: user.id,
    membershipId,
    fullName,
    phone,
  };
}

export async function assertNoOperationalAccess(stage, client, label) {
  await expectZeroRows(
    stage,
    `${label} cannot read trees`,
    client.from('trees').select('id'),
    'Only active farm members should read operational tree data.'
  );
  await expectZeroRows(
    stage,
    `${label} cannot read care_tasks`,
    client.from('care_tasks').select('id'),
    'Only active owners or assigned active workers should read care tasks.'
  );
  await expectZeroRows(
    stage,
    `${label} cannot read operational_reports`,
    client.from('operational_reports').select('id'),
    'Only active owners or active workers reading their own reports should read operational reports.'
  );
}
