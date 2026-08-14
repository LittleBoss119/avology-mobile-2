import { assertEnv } from './config.mjs';
import {
  approveWorker,
  assertCondition,
  assertEqual,
  createSignedInClient,
  createWorkerAndJoin,
  expectFailure,
  expectSuccess,
  firstRpcRow,
  getSingle,
  isoDateOffset,
  mergeState,
  requireState,
  runStage,
  todayIso,
} from './test-utils.mjs';

const STAGE = '04 sop schedule task activity';

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

  // Subjek alur postpone -> complete di bawah: jadwal manual bertarget POHON.
  // Peran ini dulu dipegang jadwal turunan SOP; care_sops dan
  // create_schedule_from_sop dilepas di migrasi 046, berikut blok uji khusus
  // SOP yang dulu ada di sini.
  //
  // Targetnya WAJIB 'tree' dengan state.treeId: assertion tree_history_view di
  // akhir stage ini memeriksa adanya baris care untuk pohon tersebut, dan itu
  // hanya terbentuk kalau tugasnya benar-benar tertaut ke pohon. Jadwal
  // manual bertarget 'custom' di bawah TIDAK bisa menggantikan peran ini.
  const treeScheduleRows = await expectSuccess(
    STAGE,
    'owner creates manual schedule targeting a tree',
    ownerClient.rpc('create_manual_schedule', {
      p_farm_id: state.farmId,
      p_title: `Tree Care Task ${state.runId}`,
      p_category: 'watering',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: state.workerId,
      p_target_type: 'tree',
      p_target_tree_id: state.treeId,
      p_custom_target_note: null,
      p_instruction: 'Water the test tree',
    }),
    'Check create_manual_schedule signature and active worker assignment validation.'
  );
  const treeSchedule = firstRpcRow(treeScheduleRows);
  assertCondition(
    STAGE,
    'manual tree schedule returns schedule_id and task_id',
    Boolean(treeSchedule?.schedule_id && treeSchedule?.task_id),
    'create_manual_schedule did not return schedule_id/task_id.',
    'Check RPC return table definition.'
  );

  await expectFailure(
    STAGE,
    'manual custom target requires custom note',
    ownerClient.rpc('create_manual_schedule', {
      p_farm_id: state.farmId,
      p_title: `Invalid Manual Custom ${state.runId}`,
      p_category: 'other',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: state.workerId,
      p_target_type: 'custom',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Invalid custom target',
    }),
    'care_schedules_target_check should require custom_target_note for manual custom targets.'
  );

  const manualScheduleRows = await expectSuccess(
    STAGE,
    'owner creates manual schedule with custom target note',
    ownerClient.rpc('create_manual_schedule', {
      p_farm_id: state.farmId,
      p_title: `Manual Custom Task ${state.runId}`,
      p_category: 'other',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: state.workerId,
      p_target_type: 'custom',
      p_target_tree_id: null,
      p_custom_target_note: 'Manual custom target for database test',
      p_instruction: 'Handle manual custom task',
    }),
    'Manual schedule custom target should be allowed only with custom_target_note.'
  );
  const manualSchedule = firstRpcRow(manualScheduleRows);

  const secondWorker = await createWorkerAndJoin({
    stage: STAGE,
    runId: state.runId,
    label: 'avology-second-active-worker',
    joinCode: state.joinCode,
    fullName: `Second Active Worker ${state.runId}`,
    phone: '085555555555',
  });
  await approveWorker(STAGE, ownerClient, secondWorker.membershipId);

  const otherWorkerScheduleRows = await expectSuccess(
    STAGE,
    'owner creates task for another active worker',
    ownerClient.rpc('create_manual_schedule', {
      p_farm_id: state.farmId,
      p_title: `Other Worker Task ${state.runId}`,
      p_category: 'weeding',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: secondWorker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Task for another worker',
    }),
    'Owner should be able to create tasks for active workers only.'
  );
  const otherWorkerSchedule = firstRpcRow(otherWorkerScheduleRows);

  const workerTasks = await expectSuccess(
    STAGE,
    'worker sees own tasks',
    workerClient.from('care_tasks').select('id, assigned_to, status').eq('farm_id', state.farmId),
    'Workers should be able to view only their assigned tasks.'
  );
  assertCondition(
    STAGE,
    'worker cannot see task assigned to another worker',
    workerTasks.length >= 2
      && workerTasks.every((task) => task.assigned_to === state.workerId)
      && !workerTasks.some((task) => task.id === otherWorkerSchedule.task_id),
    'Worker saw a task assigned to another worker, or did not see own tasks.',
    'Check care_tasks SELECT policy.'
  );

  const manualActivitiesBefore = await expectSuccess(
    STAGE,
    'care_tasks can have zero activities before worker action',
    ownerClient.from('care_activities').select('id').eq('care_task_id', manualSchedule.task_id),
    'care_tasks to care_activities should be 0..N.'
  );
  assertEqual(STAGE, 'manual task has zero activities initially', manualActivitiesBefore.length, 0,
    'A task should be allowed to exist before any care_activities rows.');

  const postponedActivityId = await expectSuccess(
    STAGE,
    'worker postpones task',
    workerClient.rpc('postpone_task', {
      p_task_id: treeSchedule.task_id,
      p_note: 'Need more water supply',
      // WAJIB sejak migrasi 049. Ketiga parameter postpone_task tidak punya
      // default, jadi pemanggilan dua-argumen yang dulu ada di sini gagal
      // dengan PGRST202 sejak 049 dijalankan. Tanggalnya harus SETELAH hari
      // ini -- menunda ke hari ini atau ke masa lalu ditolak RPC.
      p_postponed_until: isoDateOffset(3),
    }),
    'Check postpone_task(p_task_id uuid, p_note text, p_postponed_until date), active worker status, and task assignment.'
  );
  assertCondition(STAGE, 'postpone_task returns activity id', Boolean(postponedActivityId),
    'postpone_task should return care_activities.id.',
    'Check postpone_task RPC return value.');

  const taskAfterPostpone = await getSingle(
    STAGE,
    'care_tasks status follows postponed activity',
    ownerClient.from('care_tasks').select('id, status').eq('id', treeSchedule.task_id).single(),
    'sync_task_status_from_activity trigger should update care_tasks.status.'
  );
  assertEqual(STAGE, 'task status is postponed', taskAfterPostpone.status, 'postponed',
    'Latest postponed activity should set task status postponed.');

  const completedActivityId = await expectSuccess(
    STAGE,
    'worker completes task',
    workerClient.rpc('complete_task', {
      p_task_id: treeSchedule.task_id,
      p_note: 'Task completed after postponement',
    }),
    'Check complete_task(p_task_id uuid, p_note text), active worker status, and task assignment.'
  );
  assertCondition(STAGE, 'complete_task returns activity id', Boolean(completedActivityId),
    'complete_task should return care_activities.id.',
    'Check complete_task RPC return value.');

  const activities = await expectSuccess(
    STAGE,
    'task has multiple care_activities',
    ownerClient
      .from('care_activities')
      .select('id, status')
      .eq('care_task_id', treeSchedule.task_id)
      .order('performed_at', { ascending: true }),
    'care_tasks to care_activities should support 0..N activities.'
  );
  assertCondition(
    STAGE,
    'care_tasks to care_activities is 0..N',
    activities.length >= 2
      && activities.some((activity) => activity.status === 'postponed')
      && activities.some((activity) => activity.status === 'completed'),
    'Expected at least postponed and completed activities for the same task.',
    'Check care_activities FK and sync_task_status_from_activity.'
  );

  const taskAfterComplete = await getSingle(
    STAGE,
    'care_tasks status follows latest completed activity',
    ownerClient.from('care_tasks').select('id, status').eq('id', treeSchedule.task_id).single(),
    'sync_task_status_from_activity trigger should update care_tasks.status from latest activity.'
  );
  assertEqual(STAGE, 'task status is completed', taskAfterComplete.status, 'completed',
    'Latest completed activity should set task status completed.');

  const careHistory = await expectSuccess(
    STAGE,
    'tree_history_view includes care activity for tree task',
    ownerClient.from('tree_history_view').select('tree_id, history_type, title').eq('tree_id', state.treeId),
    'tree_history_view should include care activity rows for tree-targeted tasks.'
  );
  assertCondition(
    STAGE,
    'history includes care activity',
    careHistory.some((row) => row.history_type === 'care' && row.tree_id === state.treeId),
    'tree_history_view did not include care activity for tree task.',
    'Check tree_history_view care union and target_tree_id.'
  );

  // sopId / sopScheduleId / sopTaskId dibuang bersama fitur SOP. Ketiganya
  // tidak pernah dibaca stage mana pun, jadi penghapusannya tidak memutus
  // dependensi antar-stage; nilai basi di .db-test-state.local.json akan
  // tertimpa pada run berikutnya.
  mergeState({
    treeScheduleId: treeSchedule.schedule_id,
    treeTaskId: treeSchedule.task_id,
    manualScheduleId: manualSchedule.schedule_id,
    manualTaskId: manualSchedule.task_id,
    otherWorkerId: secondWorker.userId,
    otherWorkerTaskId: otherWorkerSchedule.task_id,
  });
});
