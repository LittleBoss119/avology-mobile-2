import { assertEnv, STATE_FILE_PATH } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createUserWithProfile,
  expectSuccess,
  expectZeroRows,
  firstRpcRow,
  makeRunId,
  mergeState,
  runStage,
  TEST_PASSWORD,
  uniqueEmail,
} from './test-utils.mjs';

const STAGE = '01 auth profile membership';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const ownerEmail = uniqueEmail('avology-owner', runId);
  const workerEmail = uniqueEmail('avology-worker', runId);

  const owner = await createUserWithProfile({
    email: ownerEmail,
    fullName: `Owner ${runId}`,
    phone: '081111111111',
  });
  console.log('✅ owner signed up, signed in, and profile exists');

  const worker = await createUserWithProfile({
    email: workerEmail,
    fullName: `Worker ${runId}`,
    phone: '082222222222',
  });
  console.log('✅ worker signed up, signed in, and profile exists');

  const ownerSelfProfile = await expectSuccess(
    STAGE,
    'owner can read own profile',
    owner.client.from('profiles').select('id, full_name, phone').eq('id', owner.user.id),
    'profiles SELECT should allow users to view their own profile.'
  );
  assertEqual(STAGE, 'owner sees exactly one own profile row', ownerSelfProfile.length, 1,
    'profiles RLS should not hide the owner profile from the owner.');

  const workerSelfProfile = await expectSuccess(
    STAGE,
    'worker can read own profile',
    worker.client.from('profiles').select('id, full_name, phone').eq('id', worker.user.id),
    'profiles SELECT should allow users to view their own profile.'
  );
  assertEqual(STAGE, 'worker sees exactly one own profile row', workerSelfProfile.length, 1,
    'profiles RLS should not hide the worker profile from the worker.');

  await expectZeroRows(
    STAGE,
    'owner cannot read worker profile directly',
    owner.client.from('profiles').select('id').eq('id', worker.user.id),
    'Owner access to worker profile basics should go through safe RPC, not direct profiles SELECT.'
  );
  await expectZeroRows(
    STAGE,
    'worker cannot read owner profile directly',
    worker.client.from('profiles').select('id').eq('id', owner.user.id),
    'Workers should not read other profiles directly.'
  );

  const farmId = await expectSuccess(
    STAGE,
    'owner creates farm through RPC',
    owner.client.rpc('create_farm_with_owner', {
      p_name: `Avology DB Test Farm ${runId}`,
      p_location: 'Database Test Location',
      p_area_size: 1.25,
    }),
    'Check create_farm_with_owner(p_name, p_location, p_area_size) and owner profile existence.'
  );

  const farm = await expectSuccess(
    STAGE,
    'owner can read created farm',
    owner.client.from('farms').select('id, join_code').eq('id', farmId).single(),
    'Active owner should be able to read their farm.'
  );

  const ownerMembership = await expectSuccess(
    STAGE,
    'owner automatically has active owner membership',
    owner.client
      .from('farm_members')
      .select('id, farm_id, user_id, role, status')
      .eq('farm_id', farmId)
      .eq('user_id', owner.user.id)
      .single(),
    'create_farm_with_owner should insert farm_members owner active row.'
  );
  assertEqual(STAGE, 'owner membership role is owner', ownerMembership.role, 'owner',
    'Owner membership role should be owner.');
  assertEqual(STAGE, 'owner membership status is active', ownerMembership.status, 'active',
    'Owner membership status should be active.');

  const workerMembershipId = await expectSuccess(
    STAGE,
    'worker requests join with join_code',
    worker.client.rpc('request_join_farm', { p_join_code: farm.join_code }),
    'Check request_join_farm(p_join_code text), join_code value, and worker profile existence.'
  );

  const workerOwnMembership = await expectSuccess(
    STAGE,
    'pending worker can read only own membership status',
    worker.client
      .from('farm_members')
      .select('id, farm_id, user_id, role, status')
      .eq('farm_id', farmId),
    'farm_members SELECT should allow own row and hide other farm memberships from worker.'
  );
  assertEqual(STAGE, 'pending worker sees exactly one membership row', workerOwnMembership.length, 1,
    'Pending worker should see only their own membership row.');
  assertEqual(STAGE, 'worker membership status is pending', workerOwnMembership[0].status, 'pending',
    'request_join_farm should create pending membership.');

  const basicProfiles = await expectSuccess(
    STAGE,
    'owner can read member basic profiles through RPC',
    owner.client.rpc('get_member_basic_profiles', { p_farm_id: farmId }),
    'Owner active should be able to read member basic profiles through get_member_basic_profiles.'
  );
  assertCondition(
    STAGE,
    'member basic profile RPC includes worker full_name and phone',
    basicProfiles.some((row) => row.user_id === worker.user.id && row.full_name && row.phone),
    'Expected worker basic profile in get_member_basic_profiles result.',
    'Check get_member_basic_profiles return columns and owner active validation.'
  );

  mergeState({
    runId,
    password: TEST_PASSWORD,
    ownerEmail,
    ownerId: owner.user.id,
    workerEmail,
    workerId: worker.user.id,
    farmId,
    joinCode: farm.join_code,
    ownerMembershipId: ownerMembership.id,
    workerMembershipId: firstRpcRow(workerMembershipId),
    workerFullName: `Worker ${runId}`,
    workerPhone: '082222222222',
  });

  console.log(`✅ test state saved to ${STATE_FILE_PATH}`);
});
