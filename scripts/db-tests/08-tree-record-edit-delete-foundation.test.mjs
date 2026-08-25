import { assertEnv } from './config.mjs';
import {
  assertEqual,
  createSignedInClient,
  expectFailure,
  expectSuccess,
  getSingle,
  requireState,
  runStage,
} from './test-utils.mjs';

const STAGE = '08 tree record edit/delete foundation';

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'ownerEmail',
    'ownerId',
    'workerEmail',
    'workerId',
    'farmId',
    'treeId',
    'password',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);
  const futureReportedAt = '2099-01-01T00:00:00.000Z';
  const futureRecordedAt = '2099-01-02T00:00:00.000Z';

  const condition = await getSingle(
    STAGE,
    'worker creates editable condition report',
    workerClient
      .from('tree_condition_reports')
      .insert({
        condition_status: 'damaged',
        farm_id: state.farmId,
        note: 'Condition edit/delete foundation test',
        reported_at: futureReportedAt,
        reported_by: state.workerId,
        tree_id: state.treeId,
      })
      .select('id')
      .single(),
    'Active workers should still be able to create condition reports.'
  );

  await expectFailure(
    STAGE,
    'owner cannot update worker condition report',
    ownerClient.rpc('update_own_tree_condition_report', {
      p_condition_status: 'healthy',
      p_note: 'Owner should not be able to change worker record',
      p_report_id: condition.id,
      p_reported_at: futureReportedAt,
    }),
    'Only the original author should be able to edit tree condition reports.'
  );

  await expectSuccess(
    STAGE,
    'worker updates own condition report',
    workerClient.rpc('update_own_tree_condition_report', {
      p_condition_status: 'disease_indicated',
      p_note: 'Updated condition foundation test',
      p_report_id: condition.id,
      p_reported_at: futureReportedAt,
    }),
    'update_own_tree_condition_report should update author-owned active records.'
  );

  const treeAfterCondition = await getSingle(
    STAGE,
    'condition update recalculates current tree condition',
    ownerClient
      .from('trees')
      .select('id, current_condition')
      .eq('id', state.treeId)
      .single(),
    'Editing the latest condition report should recalculate trees.current_condition.'
  );
  assertEqual(
    STAGE,
    'tree current condition follows latest non-deleted report',
    treeAfterCondition.current_condition,
    'disease_indicated',
    'Check recalculate_tree_current_condition and update_own_tree_condition_report.'
  );

  const phase = await getSingle(
    STAGE,
    'worker creates editable growth phase record',
    workerClient
      .from('growth_phase_records')
      .insert({
        farm_id: state.farmId,
        note: 'Growth phase edit/delete foundation test',
        phase: 'flowering',
        recorded_at: futureRecordedAt,
        recorded_by: state.workerId,
        tree_id: state.treeId,
      })
      .select('id')
      .single(),
    'Active workers should still be able to create growth phase records.'
  );

  await expectSuccess(
    STAGE,
    'worker updates own growth phase record',
    workerClient.rpc('update_own_growth_phase_record', {
      p_note: 'Updated phase foundation test',
      p_phase: 'fruiting',
      p_record_id: phase.id,
      p_recorded_at: futureRecordedAt,
    }),
    'update_own_growth_phase_record should update author-owned active records.'
  );

  const treeAfterPhase = await getSingle(
    STAGE,
    'phase update recalculates current tree phase',
    ownerClient
      .from('trees')
      .select('id, current_growth_phase')
      .eq('id', state.treeId)
      .single(),
    'Editing the latest phase record should recalculate trees.current_growth_phase.'
  );
  assertEqual(
    STAGE,
    'tree current phase follows latest non-deleted phase',
    treeAfterPhase.current_growth_phase,
    'fruiting',
    'Check recalculate_tree_current_growth_phase and update_own_growth_phase_record.'
  );

  const harvest = await getSingle(
    STAGE,
    'owner creates editable harvest record',
    ownerClient
      .from('harvest_records')
      .insert({
        farm_id: state.farmId,
        fruit_count: 2,
        harvested_by: state.ownerId,
        note: 'Harvest edit/delete foundation test',
        tree_id: state.treeId,
      })
      .select('id')
      .single(),
    'Active owners should still be able to create harvest records.'
  );

  await expectSuccess(
    STAGE,
    'owner updates own harvest record',
    ownerClient.rpc('update_own_harvest_record', {
      p_fruit_condition: 'A2',
      p_fruit_count: 5,
      p_harvested_at: null,
      p_note: 'Updated harvest foundation test',
      p_record_id: harvest.id,
    }),
    'update_own_harvest_record should update author-owned active records.'
  );

  // Pembuatan manual_care_record dan RPC update_own_manual_care_record dibuang:
  // tabel manual_care_records di-drop migrasi 031. Padanan hidupnya adalah
  // care_activities, yang jalur edit/hapusnya diuji stage 12 dan 14.

  const historyBeforeDelete = await expectSuccess(
    STAGE,
    'tree_history_view exposes source_id',
    ownerClient
      .from('tree_history_view')
      .select('source_id, history_type')
      .eq('tree_id', state.treeId)
      .in('source_id', [condition.id, phase.id, harvest.id]),
    'tree_history_view should expose source_id for tree record detail routing.'
  );
  // Tiga, bukan empat: manualCare.id dibuang bersama bloknya di atas, dan angka
  // 4 memang sudah tidak pernah tercapai sejak migrasi 028 mencabut union
  // 'manual_care' dari tree_history_view.
  //
  // Label "before delete" ikut dilepas: ketiga RPC soft_delete_own_* dibuang
  // migrasi 031, jadi tidak ada lagi penghapusan setelah baris ini. Cakupan
  // soft-delete akan kembali bersama fitur hapus catatan.
  assertEqual(
    STAGE,
    'history contains three source rows',
    historyBeforeDelete.length,
    3,
    'Condition, phase, and harvest records should appear in tree_history_view.'
  );
});
