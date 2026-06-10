import { assertEnv } from './config.mjs';
import {
  approveWorker,
  assertCondition,
  assertEqual,
  assertNoOperationalAccess,
  createSignedInClient,
  createWorkerAndJoin,
  expectSuccess,
  expectZeroRows,
  mergeState,
  requireState,
  runStage,
} from './test-utils.mjs';

const STAGE = '02 worker management rls';

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'runId',
    'ownerEmail',
    'workerEmail',
    'farmId',
    'joinCode',
    'workerId',
    'workerMembershipId',
    'workerFullName',
    'workerPhone',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);

  const pendingWorkers = await expectSuccess(
    STAGE,
    'owner calls get_pending_workers',
    ownerClient.rpc('get_pending_workers', { p_farm_id: state.farmId }),
    'Check get_pending_workers(p_farm_id uuid) and active owner validation.'
  );
  const pendingWorker = pendingWorkers.find((row) => row.user_id === state.workerId);
  assertCondition(
    STAGE,
    'get_pending_workers returns full_name and phone',
    pendingWorker?.full_name === state.workerFullName && pendingWorker?.phone === state.workerPhone,
    'Pending worker row did not include expected full_name and phone.',
    'Check get_pending_workers return columns and join to profiles.'
  );

  await assertNoOperationalAccess(STAGE, workerClient, 'pending worker');

  await approveWorker(STAGE, ownerClient, state.workerMembershipId);

  const activeMembership = await expectSuccess(
    STAGE,
    'worker becomes active',
    ownerClient
      .from('farm_members')
      .select('id, user_id, role, status')
      .eq('id', state.workerMembershipId)
      .single(),
    'Owner active should see farm member rows in their farm.'
  );
  assertEqual(STAGE, 'approved worker status is active', activeMembership.status, 'active',
    'approve_worker should set status active.');

  const activeWorkers = await expectSuccess(
    STAGE,
    'owner calls get_active_workers',
    ownerClient.rpc('get_active_workers', { p_farm_id: state.farmId }),
    'Check get_active_workers(p_farm_id uuid) and active owner validation.'
  );
  const activeWorker = activeWorkers.find((row) => row.user_id === state.workerId);
  assertCondition(
    STAGE,
    'get_active_workers returns full_name and phone',
    activeWorker?.full_name === state.workerFullName && activeWorker?.phone === state.workerPhone,
    'Active worker row did not include expected full_name and phone.',
    'Check get_active_workers return columns and join to profiles.'
  );

  const pickerWorkers = await expectSuccess(
    STAGE,
    'owner calls get_active_workers_for_task_picker',
    ownerClient.rpc('get_active_workers_for_task_picker', { p_farm_id: state.farmId }),
    'Check get_active_workers_for_task_picker(p_farm_id uuid).'
  );
  assertCondition(
    STAGE,
    'task picker returns only active worker minimal rows',
    pickerWorkers.some((row) => row.user_id === state.workerId && row.full_name === state.workerFullName)
      && pickerWorkers.every((row) => Object.keys(row).sort().join(',') === 'full_name,user_id'),
    'Task picker should include active workers only and only user_id/full_name.',
    'Check get_active_workers_for_task_picker filters and return columns.'
  );

  const workerVisibleMemberships = await expectSuccess(
    STAGE,
    'active worker reads farm_members',
    workerClient.from('farm_members').select('id, user_id, role, status').eq('farm_id', state.farmId),
    'farm_members SELECT should let workers see their own row only.'
  );
  assertEqual(STAGE, 'active worker sees only one membership row', workerVisibleMemberships.length, 1,
    'Worker active must not see memberships for other users.');
  assertEqual(STAGE, 'active worker visible membership is own row', workerVisibleMemberships[0].user_id, state.workerId,
    'Worker active must not see owner or other worker membership rows.');

  const removedWorker = await createWorkerAndJoin({
    stage: STAGE,
    runId: state.runId,
    label: 'avology-removed-worker',
    joinCode: state.joinCode,
    fullName: `Removed Worker ${state.runId}`,
    phone: '083333333333',
  });
  await approveWorker(STAGE, ownerClient, removedWorker.membershipId);
  await expectSuccess(
    STAGE,
    'owner removes worker',
    ownerClient.rpc('remove_worker', { p_farm_member_id: removedWorker.membershipId }),
    'Check remove_worker(p_farm_member_id uuid) and active owner validation.'
  );
  await assertNoOperationalAccess(STAGE, removedWorker.client, 'removed worker');

  const rejectedWorker = await createWorkerAndJoin({
    stage: STAGE,
    runId: state.runId,
    label: 'avology-rejected-worker',
    joinCode: state.joinCode,
    fullName: `Rejected Worker ${state.runId}`,
    phone: '084444444444',
  });
  await expectSuccess(
    STAGE,
    'owner rejects worker',
    ownerClient.rpc('reject_worker', { p_farm_member_id: rejectedWorker.membershipId }),
    'Check reject_worker(p_farm_member_id uuid) and active owner validation.'
  );
  await assertNoOperationalAccess(STAGE, rejectedWorker.client, 'rejected worker');

  await expectZeroRows(
    STAGE,
    'worker cannot read profiles of other users through direct profiles table',
    workerClient.from('profiles').select('id').neq('id', state.workerId),
    'Worker profile visibility should remain limited to own profile outside safe owner RPC.'
  );

  mergeState({
    workerMembershipStatus: 'active',
    removedWorkerId: removedWorker.userId,
    removedWorkerMembershipId: removedWorker.membershipId,
    rejectedWorkerId: rejectedWorker.userId,
    rejectedWorkerMembershipId: rejectedWorker.membershipId,
  });
});
