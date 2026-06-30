import { assertEnv } from './config.mjs';
import {
  approveWorker,
  assertCondition,
  assertEqual,
  createSignedInClient,
  createWorkerAndJoin,
  expectSuccess,
  firstRpcRow,
  getSingle,
  requireState,
  runStage,
  todayIso,
} from './test-utils.mjs';

const STAGE = '07 feature foundation';

await runStage(STAGE, async () => {
  assertEnv();
  const state = requireState(STAGE, [
    'runId',
    'ownerEmail',
    'ownerId',
    'workerEmail',
    'farmId',
    'joinCode',
    'treeId',
    'workerId',
    'operationalReportId',
  ]);

  const { client: ownerClient } = await createSignedInClient(state.ownerEmail, state.password);
  const { client: workerClient } = await createSignedInClient(state.workerEmail, state.password);

  const harvest = await getSingle(
    STAGE,
    'owner creates harvest_record',
    ownerClient
      .from('harvest_records')
      .insert({
        farm_id: state.farmId,
        tree_id: state.treeId,
        harvested_by: state.ownerId,
        fruit_count: 3,
        fruit_condition: 'Good test harvest',
        note: 'Actual harvest record test',
      })
      .select('id, farm_id, tree_id, fruit_count')
      .single(),
    'harvest_records should exist and allow active owners to insert actual harvest logs.'
  );
  assertEqual(STAGE, 'harvest fruit_count stored', harvest.fruit_count, 3,
    'harvest_records.fruit_count should be stored as a positive integer.');

  const manualCare = await getSingle(
    STAGE,
    'worker creates manual_care_record for tree',
    workerClient
      .from('manual_care_records')
      .insert({
        farm_id: state.farmId,
        recorded_by: state.workerId,
        category: 'watering',
        target_type: 'tree',
        target_tree_id: state.treeId,
        note: 'Manual care database test',
      })
      .select('id, farm_id, target_type, target_tree_id')
      .single(),
    'manual_care_records should exist and allow active workers to insert own records.'
  );
  assertEqual(STAGE, 'manual care targets tree', manualCare.target_tree_id, state.treeId,
    'manual_care_records.target_tree_id should store the tree target.');

  const growthPhase = await getSingle(
    STAGE,
    'worker creates growth phase record for photo constraint',
    workerClient
      .from('growth_phase_records')
      .insert({
        farm_id: state.farmId,
        tree_id: state.treeId,
        recorded_by: state.workerId,
        phase: 'flowering',
        note: 'Growth phase photo entity test',
      })
      .select('id')
      .single(),
    'Existing growth_phase_records insert should still work.'
  );

  const harvestPhotoRows = await expectSuccess(
    STAGE,
    'harvest photo entity type is accepted',
    ownerClient
      .from('photo_attachments')
      .insert({
        farm_id: state.farmId,
        uploaded_by: state.ownerId,
        entity_type: 'harvest_record',
        entity_id: harvest.id,
        bucket: 'avology-photos',
        storage_path: `farms/${state.farmId}/harvest-records/${harvest.id}/db-test-harvest.jpg`,
        file_name: 'db-test-harvest.jpg',
        mime_type: 'image/jpeg',
        file_size: 12,
      })
      .select('id, entity_type'),
    'photo_attachments constraints and RLS should allow harvest_record metadata.'
  );
  const growthPhasePhotoRows = await expectSuccess(
    STAGE,
    'growth phase photo entity type is accepted',
    workerClient
      .from('photo_attachments')
      .insert({
        farm_id: state.farmId,
        uploaded_by: state.workerId,
        entity_type: 'growth_phase_record',
        entity_id: growthPhase.id,
        bucket: 'avology-photos',
        storage_path: `farms/${state.farmId}/growth-phase-records/${growthPhase.id}/db-test-phase.jpg`,
        file_name: 'db-test-phase.jpg',
        mime_type: 'image/jpeg',
        file_size: 12,
      })
      .select('id, entity_type'),
    'photo_attachments constraints and RLS should allow growth_phase_record metadata.'
  );
  const manualCarePhotoRows = await expectSuccess(
    STAGE,
    'manual care photo entity type is accepted',
    workerClient
      .from('photo_attachments')
      .insert({
        farm_id: state.farmId,
        uploaded_by: state.workerId,
        entity_type: 'manual_care_record',
        entity_id: manualCare.id,
        bucket: 'avology-photos',
        storage_path: `farms/${state.farmId}/manual-care-records/${manualCare.id}/db-test-manual.jpg`,
        file_name: 'db-test-manual.jpg',
        mime_type: 'image/jpeg',
        file_size: 12,
      })
      .select('id, entity_type'),
    'photo_attachments constraints and RLS should allow manual_care_record metadata.'
  );
  const photoRows = [...harvestPhotoRows, ...growthPhasePhotoRows, ...manualCarePhotoRows];
  assertEqual(STAGE, 'three new photo metadata rows inserted', photoRows.length, 3,
    'Expected growth_phase_record, harvest_record, and manual_care_record photo metadata.');

  await expectSuccess(
    STAGE,
    'owner deletes test photo metadata rows',
    ownerClient.from('photo_attachments').delete().in('id', photoRows.map((row) => row.id)),
    'Owner should be able to clean up test photo attachment metadata.'
  );

  const historyRows = await expectSuccess(
    STAGE,
    'tree_history_view includes harvest and manual care',
    ownerClient
      .from('tree_history_view')
      .select('tree_id, history_type, title')
      .eq('tree_id', state.treeId),
    'tree_history_view should include new harvest/manual care unions.'
  );
  assertCondition(
    STAGE,
    'history includes harvest record',
    historyRows.some((row) => row.history_type === 'harvest' && row.title === 'Panen dicatat'),
    'Harvest record did not appear in tree_history_view.',
    'Check tree_history_view harvest union.'
  );
  assertCondition(
    STAGE,
    'history includes manual care record',
    historyRows.some((row) => row.history_type === 'manual_care' && row.title === 'Perawatan manual'),
    'Manual care record did not appear in tree_history_view.',
    'Check tree_history_view manual care union.'
  );

  const cancelScheduleRows = await expectSuccess(
    STAGE,
    'owner creates cancellable schedule',
    ownerClient.rpc('create_manual_schedule', {
      p_farm_id: state.farmId,
      p_title: `Cancellable Schedule ${state.runId}`,
      p_category: 'other',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: state.workerId,
      p_target_type: 'farm',
      p_target_row: null,
      p_target_column: null,
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Cancellable schedule database test',
    }),
    'create_manual_schedule should still create a schedule before cancel RPC validation.'
  );
  const cancelSchedule = firstRpcRow(cancelScheduleRows);

  await expectSuccess(
    STAGE,
    'owner cancels schedule before realization',
    ownerClient.rpc('cancel_care_schedule', {
      p_schedule_id: cancelSchedule.schedule_id,
      p_reason: 'Database foundation test cancel',
    }),
    'cancel_care_schedule should allow active owner cancellation before activities exist.'
  );

  const cancelled = await getSingle(
    STAGE,
    'schedule cancellation fields are set',
    ownerClient
      .from('care_schedules')
      .select('id, is_cancelled, cancelled_by, cancelled_at, cancel_reason')
      .eq('id', cancelSchedule.schedule_id)
      .single(),
    'care_schedules should expose cancellation audit columns.'
  );
  assertEqual(STAGE, 'schedule is_cancelled true', cancelled.is_cancelled, true,
    'cancel_care_schedule should set is_cancelled true.');
  assertEqual(STAGE, 'schedule cancelled_by owner', cancelled.cancelled_by, state.ownerId,
    'cancel_care_schedule should set cancelled_by to auth.uid().');

  await expectSuccess(
    STAGE,
    'owner reopens resolved operational report',
    ownerClient.rpc('reopen_operational_report', {
      p_report_id: state.operationalReportId,
      p_note: 'Reopen database foundation test',
    }),
    'reopen_operational_report should allow active owner to reopen final reports.'
  );

  const reopenedReport = await getSingle(
    STAGE,
    'reopened report is in progress with audit fields',
    ownerClient
      .from('operational_reports')
      .select('id, status, owner_response_note, responded_by, responded_at')
      .eq('id', state.operationalReportId)
      .single(),
    'operational_reports should expose response audit columns.'
  );
  assertEqual(STAGE, 'reopened report status is in_progress', reopenedReport.status, 'in_progress',
    'reopen_operational_report should set status to in_progress.');
  assertEqual(STAGE, 'reopened report responded_by owner', reopenedReport.responded_by, state.ownerId,
    'reopen_operational_report should set responded_by to auth.uid().');

  const leavingWorker = await createWorkerAndJoin({
    stage: STAGE,
    runId: state.runId,
    label: 'avology-leaving-worker',
    joinCode: state.joinCode,
    fullName: `Leaving Worker ${state.runId}`,
    phone: '087777777777',
  });
  await approveWorker(STAGE, ownerClient, leavingWorker.membershipId);

  await expectSuccess(
    STAGE,
    'worker leaves own active farm',
    leavingWorker.client.rpc('leave_current_farm', { p_farm_id: state.farmId }),
    'leave_current_farm should allow only active workers to remove their own membership.'
  );

  const leftMembership = await getSingle(
    STAGE,
    'left membership keeps removed audit fields',
    ownerClient
      .from('farm_members')
      .select('id, status, removed_by, removed_at, removed_reason')
      .eq('id', leavingWorker.membershipId)
      .single(),
    'Worker leave should preserve membership history and mark status removed.'
  );
  assertEqual(STAGE, 'left worker status removed', leftMembership.status, 'removed',
    'leave_current_farm should reuse member_status removed.');
  assertEqual(STAGE, 'left worker removed reason', leftMembership.removed_reason, 'left_by_worker',
    'leave_current_farm should store removed_reason left_by_worker.');
});
