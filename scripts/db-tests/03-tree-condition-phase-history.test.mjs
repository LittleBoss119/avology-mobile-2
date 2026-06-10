import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createSignedInClient,
  expectDeniedOrNoRows,
  expectSuccess,
  getSingle,
  mergeState,
  requireState,
  runStage,
  todayIso,
} from './test-utils.mjs';

const STAGE = '03 tree condition phase history';

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'runId',
    'ownerEmail',
    'workerEmail',
    'farmId',
    'workerId',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);

  const tree = await getSingle(
    STAGE,
    'owner creates tree',
    ownerClient
      .from('trees')
      .insert({
        farm_id: state.farmId,
        tree_code: `TREE-${state.runId}`,
        row_position: 'A',
        column_position: '1',
        variety: 'Alpukat Test',
        planted_at: todayIso(),
      })
      .select('id, farm_id, tree_code, variety, is_archived')
      .single(),
    'Active owner should be able to insert trees.'
  );

  await getSingle(
    STAGE,
    'owner updates tree',
    ownerClient
      .from('trees')
      .update({ variety: 'Alpukat Test Updated' })
      .eq('id', tree.id)
      .select('id, variety')
      .single(),
    'Active owner should be able to update trees.'
  );

  const archivedTree = await getSingle(
    STAGE,
    'owner archives tree without permanent delete',
    ownerClient
      .from('trees')
      .update({ is_archived: true })
      .eq('id', tree.id)
      .select('id, is_archived')
      .single(),
    'Trees should use is_archived instead of permanent delete.'
  );
  assertEqual(STAGE, 'tree is archived', archivedTree.is_archived, true,
    'Tree archive should set is_archived true.');

  const restoredTree = await getSingle(
    STAGE,
    'owner restores tree by unarchive',
    ownerClient
      .from('trees')
      .update({ is_archived: false })
      .eq('id', tree.id)
      .select('id, is_archived')
      .single(),
    'Tree restore/unarchive should be supported by updating is_archived false.'
  );
  assertEqual(STAGE, 'tree is unarchived', restoredTree.is_archived, false,
    'Tree unarchive should set is_archived false.');

  const workerTrees = await expectSuccess(
    STAGE,
    'active worker can view tree',
    workerClient.from('trees').select('id, tree_code').eq('id', tree.id),
    'Active workers should be able to view farm trees.'
  );
  assertEqual(STAGE, 'worker sees created tree', workerTrees.length, 1,
    'Active worker should see farm tree data.');

  await expectDeniedOrNoRows(
    STAGE,
    'worker cannot edit or archive tree',
    workerClient.from('trees').update({ is_archived: true }).eq('id', tree.id).select('id'),
    'Only active owners should be allowed to update trees.'
  );

  await getSingle(
    STAGE,
    'worker creates tree condition report',
    workerClient
      .from('tree_condition_reports')
      .insert({
        farm_id: state.farmId,
        tree_id: tree.id,
        reported_by: state.workerId,
        condition_status: 'needs_attention',
        note: 'Database test condition report',
      })
      .select('id, condition_status')
      .single(),
    'Active farm members should be able to insert condition reports for farm trees.'
  );

  const conditionTree = await getSingle(
    STAGE,
    'tree current_condition follows latest report',
    ownerClient.from('trees').select('id, current_condition').eq('id', tree.id).single(),
    'sync_tree_current_condition trigger should update trees.current_condition.'
  );
  assertEqual(STAGE, 'current_condition updated', conditionTree.current_condition, 'needs_attention',
    'Tree current_condition should match latest condition report.');

  await getSingle(
    STAGE,
    'worker records flowering growth phase',
    workerClient
      .from('growth_phase_records')
      .insert({
        farm_id: state.farmId,
        tree_id: tree.id,
        recorded_by: state.workerId,
        phase: 'flowering',
        note: 'Monitoring flowering phase only; no harvest prediction.',
      })
      .select('id, phase')
      .single(),
    'Active farm members should be able to insert growth phase records.'
  );

  await getSingle(
    STAGE,
    'worker records fruiting growth phase',
    workerClient
      .from('growth_phase_records')
      .insert({
        farm_id: state.farmId,
        tree_id: tree.id,
        recorded_by: state.workerId,
        phase: 'fruiting',
        note: 'Monitoring fruiting phase only; no harvest estimate.',
      })
      .select('id, phase')
      .single(),
    'Growth phase is for monitoring, not automatic harvest prediction.'
  );

  const phaseTree = await getSingle(
    STAGE,
    'tree current_growth_phase follows latest phase',
    ownerClient.from('trees').select('id, current_growth_phase').eq('id', tree.id).single(),
    'sync_tree_current_growth_phase trigger should update trees.current_growth_phase.'
  );
  assertEqual(STAGE, 'current_growth_phase updated', phaseTree.current_growth_phase, 'fruiting',
    'Tree current_growth_phase should match latest growth phase record.');

  const historyRows = await expectSuccess(
    STAGE,
    'tree_history_view returns tree history',
    ownerClient.from('tree_history_view').select('tree_id, history_type, title').eq('tree_id', tree.id),
    'tree_history_view should be readable by active farm members via RLS-backed security invoker view.'
  );
  assertCondition(STAGE, 'history includes condition report',
    historyRows.some((row) => row.history_type === 'condition' && row.title === 'needs_attention'),
    'tree_history_view did not include condition report.',
    'Check tree_history_view condition union.');
  assertCondition(STAGE, 'history includes growth phase',
    historyRows.some((row) => row.history_type === 'phase' && row.title === 'fruiting'),
    'tree_history_view did not include growth phase.',
    'Check tree_history_view phase union.');

  mergeState({ treeId: tree.id });
});
