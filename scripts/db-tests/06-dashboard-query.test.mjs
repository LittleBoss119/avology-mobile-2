import { assertEnv } from './config.mjs';
import {
  assertCondition,
  createSignedInClient,
  createWorkerAndJoin,
  mergeState,
  requireState,
  runStage,
  todayIso,
} from './test-utils.mjs';

const STAGE = '06 dashboard query';

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'runId',
    'ownerEmail',
    'workerEmail',
    'farmId',
    'joinCode',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);

  const pendingDashboardWorker = await createWorkerAndJoin({
    stage: STAGE,
    runId: state.runId,
    label: 'avology-dashboard-pending-worker',
    joinCode: state.joinCode,
    fullName: `Dashboard Pending Worker ${state.runId}`,
    phone: '086666666666',
  });

  // Penghitung "laporan operasional baru" dibuang bersama modulnya (migrasi
  // 053), begitu juga pembuatan laporan yang dulu menyiapkan datanya.
  const [trees, problemTrees, pendingWorkers, ownerTasksToday, ownerUnfinishedTasks, floweringFruitingTrees] = await Promise.all([
    ownerClient.from('trees').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId),
    ownerClient.from('trees').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId).neq('current_condition', 'healthy'),
    ownerClient.from('farm_members').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId).eq('role', 'worker').eq('status', 'pending'),
    ownerClient.from('care_tasks').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId).eq('due_date', todayIso()),
    ownerClient.from('care_tasks').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId).neq('status', 'completed'),
    ownerClient.from('trees').select('id', { count: 'exact', head: true }).eq('farm_id', state.farmId).in('current_growth_phase', ['flowering', 'fruiting']),
  ]);

  for (const [label, result] of [
    ['owner total trees', trees],
    ['owner problem trees', problemTrees],
    ['owner pending workers', pendingWorkers],
    ['owner tasks today', ownerTasksToday],
    ['owner unfinished tasks', ownerUnfinishedTasks],
    ['owner flowering/fruiting trees', floweringFruitingTrees],
  ]) {
    if (result.error) {
      throw new Error(`${label}: ${result.error.message}`);
    }
    assertCondition(STAGE, `${label} dashboard query returns count`, isNumber(result.count),
      `${label} did not return a numeric count.`,
      'Check RLS and table grants for dashboard aggregate queries.');
  }

  const [workerTasksToday, workerUnfinishedTasks, workerCompletedTasks] = await Promise.all([
    workerClient.from('care_tasks').select('id', { count: 'exact', head: true }).eq('due_date', todayIso()),
    workerClient.from('care_tasks').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
    workerClient.from('care_tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  for (const [label, result] of [
    ['worker tasks today', workerTasksToday],
    ['worker unfinished tasks', workerUnfinishedTasks],
    ['worker completed tasks', workerCompletedTasks],
  ]) {
    if (result.error) {
      throw new Error(`${label}: ${result.error.message}`);
    }
    assertCondition(STAGE, `${label} dashboard query returns count`, isNumber(result.count),
      `${label} did not return a numeric count.`,
      'Check worker care_tasks SELECT policy for assigned tasks.');
  }

  assertCondition(
    STAGE,
    'manual dashboard aggregation validates expected MVP counters',
    trees.count >= 1
      && problemTrees.count >= 1
      && pendingWorkers.count >= 1
      && ownerTasksToday.count >= 1
      && floweringFruitingTrees.count >= 1
      && workerTasksToday.count >= 1,
    'One or more dashboard counters did not include expected test data.',
    'Check previous stages completed successfully and dashboard queries match MVP schema.'
  );

  mergeState({
    dashboardPendingWorkerId: pendingDashboardWorker.userId,
    dashboardPendingMembershipId: pendingDashboardWorker.membershipId,
  });
});
