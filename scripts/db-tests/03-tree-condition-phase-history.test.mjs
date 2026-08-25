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

  // Lewat RPC, bukan INSERT langsung: sejak migrasi 055 membuat pohon berarti
  // membuat posisinya DAN siklus tanam pertamanya dalam satu transaksi, dan
  // variety/planted_at sudah tidak ada lagi di tabel trees.
  //
  // Baris = angka, kolom = huruf. Stage ini menaruh tepat satu pohon di kebun
  // bersama, jadi posisi 1-A tidak pernah bentrok dengan stage lain (satu-
  // satunya stage lain yang menanam pohon, 12, memakai kebunnya sendiri).
  const treeId = await expectSuccess(
    STAGE,
    'owner creates tree with its first planting',
    ownerClient.rpc('create_tree_with_planting', {
      p_farm_id: state.farmId,
      p_row_position: 1,
      p_column_position: 'A',
      p_variety: 'Alpukat Test',
      p_planted_at: todayIso(),
    }),
    'Check create_tree_with_planting(uuid, smallint, text, text, date) after migration 055.'
  );

  const tree = await getSingle(
    STAGE,
    'created tree is readable',
    ownerClient
      .from('trees')
      .select('id, farm_id, tree_code, is_archived')
      .eq('id', treeId)
      .single(),
    'Active members should be able to read trees in their farm.'
  );
  assertEqual(STAGE, 'tree_code is derived from its position', tree.tree_code, '1-A',
    'tree_code is GENERATED from row_position and column_position (migration 054).');

  const firstPlanting = await getSingle(
    STAGE,
    'first planting cycle exists',
    ownerClient
      .from('tree_plantings')
      .select('id, cycle_no, variety, ended_at')
      .eq('tree_id', treeId)
      .single(),
    'create_tree_with_planting should open cycle 1 in the same transaction.'
  );
  assertEqual(STAGE, 'first cycle is numbered 1', firstPlanting.cycle_no, 1,
    'The first planting on a position must be cycle_no 1.');
  assertEqual(STAGE, 'first cycle is still running', firstPlanting.ended_at, null,
    'A newly created planting must not be closed.');

  // Yang bisa diedit di trees tinggal POSISINYA. variety pindah ke
  // tree_plantings di migrasi 055, jadi update lama tidak lagi mungkin.
  const movedTree = await getSingle(
    STAGE,
    'owner updates tree position',
    ownerClient
      .from('trees')
      .update({ column_position: 'B' })
      .eq('id', tree.id)
      .select('id, tree_code')
      .single(),
    'Active owner should be able to update trees.'
  );
  assertEqual(STAGE, 'tree_code follows the new position', movedTree.tree_code, '1-B',
    'tree_code is generated, so moving a tree must regenerate it.');

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
