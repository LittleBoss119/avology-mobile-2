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
        fruit_condition: 'A2',
        note: 'Actual harvest record test',
      })
      .select('id, farm_id, tree_id, fruit_count')
      .single(),
    'harvest_records should exist and allow active owners to insert actual harvest logs.'
  );
  assertEqual(STAGE, 'harvest fruit_count stored', harvest.fruit_count, 3,
    'harvest_records.fruit_count should be stored as a positive integer.');

  // Blok manual_care_records dibuang: tabelnya di-drop migrasi 031 dan tidak
  // akan kembali. Pencatatan perawatan kini hidup di care_activities +
  // care_activity_trees, yang diuji stage 12.

  await getSingle(
    STAGE,
    'worker creates growth phase record',
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

  // Ketiga insert photo_attachments di sini dibuang seluruhnya, berikut
  // penggabungan photoRows, asersi "three new photo metadata rows inserted",
  // dan pembersihannya -- keempatnya satu kesatuan dengan insert-nya.
  //
  // Alasannya: entity_type 'harvest_record', 'growth_phase_record', dan
  // 'manual_care_record' sempat sah lewat migrasi 020 (7 nilai), lalu dipangkas
  // migrasi 031 jadi tiga ('tree_main', 'condition_record', 'task_proof').
  // Migrasi 035 menambah 'operational_report' jadi empat, dan 053 memangkasnya
  // kembali jadi tiga. Ketiga nilai yang diuji di sini tidak pernah kembali,
  // jadi insert-nya pasti melanggar photo_attachments_entity_type_check.
  //
  // Cakupan foto ada di stage 17 (17-photo-attachment-policies.test.mjs):
  // ketiga entity_type yang masih hidup, keenam policy foto, dan seluruh CHECK
  // constraint photo_attachments. Stage 03 dan 04 TIDAK menyentuh foto sama
  // sekali -- komentar sebelumnya di baris ini menunjuk ke sana dan itu keliru.

  const historyRows = await expectSuccess(
    STAGE,
    'tree_history_view includes harvest',
    ownerClient
      .from('tree_history_view')
      .select('tree_id, history_type, title')
      .eq('tree_id', state.treeId),
    'tree_history_view should include the harvest union.'
  );
  assertCondition(
    STAGE,
    'history includes harvest record',
    historyRows.some((row) => row.history_type === 'harvest' && row.title === 'Panen dicatat'),
    'Harvest record did not appear in tree_history_view.',
    'Check tree_history_view harvest union.'
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

  // Blok "owner reopens resolved operational report" dibuang bersama modul
  // laporan (migrasi 053): RPC reopen_operational_report dan tabel
  // operational_reports sudah tidak ada.

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
