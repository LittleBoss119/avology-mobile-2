import { assertEnv } from './config.mjs';
import {
  assertCondition,
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
      p_fruit_condition: 'Good',
      p_fruit_count: 5,
      p_harvested_at: null,
      p_note: 'Updated harvest foundation test',
      p_record_id: harvest.id,
    }),
    'update_own_harvest_record should update author-owned active records.'
  );

  const manualCare = await getSingle(
    STAGE,
    'worker creates editable manual care record',
    workerClient
      .from('manual_care_records')
      .insert({
        category: 'watering',
        farm_id: state.farmId,
        note: 'Manual care edit/delete foundation test',
        recorded_by: state.workerId,
        target_tree_id: state.treeId,
        target_type: 'tree',
      })
      .select('id')
      .single(),
    'Active workers should still be able to create manual care records.'
  );

  await expectSuccess(
    STAGE,
    'worker updates own manual care record',
    workerClient.rpc('update_own_manual_care_record', {
      p_category: 'fertilizing',
      p_custom_target_note: null,
      p_note: 'Updated manual care foundation test',
      p_performed_at: null,
      p_record_id: manualCare.id,
      p_target_column: null,
      p_target_row: null,
      p_target_tree_id: state.treeId,
      p_target_type: 'tree',
    }),
    'update_own_manual_care_record should update author-owned active records.'
  );

  const historyBeforeDelete = await expectSuccess(
    STAGE,
    'tree_history_view exposes source_id',
    ownerClient
      .from('tree_history_view')
      .select('source_id, history_type')
      .eq('tree_id', state.treeId)
      .in('source_id', [condition.id, phase.id, harvest.id, manualCare.id]),
    'tree_history_view should expose source_id for tree record detail routing.'
  );
  assertEqual(
    STAGE,
    'history contains four source rows before delete',
    historyBeforeDelete.length,
    4,
    'Condition, phase, harvest, and manual care records should appear before soft delete.'
  );

  await expectSuccess(
    STAGE,
    'worker soft deletes own condition report',
    workerClient.rpc('soft_delete_own_tree_condition_report', {
      p_reason: 'db test cleanup',
      p_report_id: condition.id,
    }),
    'soft_delete_own_tree_condition_report should mark author-owned records deleted.'
  );
  await expectSuccess(
    STAGE,
    'worker soft deletes own growth phase record',
    workerClient.rpc('soft_delete_own_growth_phase_record', {
      p_reason: 'db test cleanup',
      p_record_id: phase.id,
    }),
    'soft_delete_own_growth_phase_record should mark author-owned records deleted.'
  );
  await expectSuccess(
    STAGE,
    'owner soft deletes own harvest record',
    ownerClient.rpc('soft_delete_own_harvest_record', {
      p_reason: 'db test cleanup',
      p_record_id: harvest.id,
    }),
    'soft_delete_own_harvest_record should mark author-owned records deleted.'
  );
  await expectSuccess(
    STAGE,
    'worker soft deletes own manual care record',
    workerClient.rpc('soft_delete_own_manual_care_record', {
      p_reason: 'db test cleanup',
      p_record_id: manualCare.id,
    }),
    'soft_delete_own_manual_care_record should mark author-owned records deleted.'
  );

  const deletedRows = await expectSuccess(
    STAGE,
    'soft delete audit columns are set',
    ownerClient
      .from('tree_condition_reports')
      .select('id, is_deleted, deleted_by, deleted_at, delete_reason')
      .eq('id', condition.id),
    'Soft delete should preserve records with audit columns instead of hard deleting.'
  );
  assertCondition(
    STAGE,
    'condition report soft delete audit populated',
    deletedRows[0]?.is_deleted === true && deletedRows[0]?.deleted_by === state.workerId,
    'Condition report soft delete audit fields were not populated.',
    'Check soft_delete_own_tree_condition_report audit update.'
  );

  const historyAfterDelete = await expectSuccess(
    STAGE,
    'tree_history_view excludes soft-deleted tree records',
    ownerClient
      .from('tree_history_view')
      .select('source_id, history_type')
      .eq('tree_id', state.treeId)
      .in('source_id', [condition.id, phase.id, harvest.id, manualCare.id]),
    'tree_history_view should filter is_deleted records out of normal timeline history.'
  );
  assertEqual(
    STAGE,
    'deleted source rows no longer visible in history',
    historyAfterDelete.length,
    0,
    'Soft-deleted condition, phase, harvest, and manual care records should be hidden from tree_history_view.'
  );
});
