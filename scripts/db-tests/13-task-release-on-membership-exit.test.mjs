import { assertEnv } from './config.mjs';
import {
  approveWorker,
  assertCondition,
  assertEqual,
  createIsolatedFarmWithWorker,
  expectFailure,
  expectSuccess,
  firstRpcRow,
  getSingle,
  isoDateOffset,
  joinWorkerToFarm,
  makeRunId,
  runStage,
  signUpActor,
  todayIso,
} from './test-utils.mjs';

// Menguji pelepasan tugas yang dibangun migrasi 051:
//   - pekerja yang keluar sendiri melepas tugas terbukanya
//   - owner yang mengeluarkan pekerja menghasilkan pelepasan yang sama
//   - jadwal yang tugasnya dilepas bisa ditugaskan ulang
//   - tugas terlepas tidak lagi terhitung sebagai tunggakan
//   - mendaftar ulang tidak memunculkan tugas hantu
//
// Stage berdiri sendiri: pelepasan mengubah keanggotaan, dan menjalankannya di
// kebun bersama akan mencabut pekerja yang dipakai stage 04 sampai 08.

const STAGE = '13 task release on membership exit';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'release',
    workerPhone: '081999004001',
  });

  // Pekerja kedua, disiapkan sejak awal sebagai penerima penugasan ulang.
  const standbyWorker = await signUpActor({
    runId,
    label: 'avology-release-standby',
    fullName: `Standby Worker ${runId}`,
    phone: '081999004002',
  });
  const standbyMembershipId = firstRpcRow(
    await joinWorkerToFarm(STAGE, standbyWorker.client, farm.join_code)
  );
  await approveWorker(STAGE, owner.client, standbyMembershipId);

  // ---------- 1. Pekerja keluar sendiri ----------

  const leaveScheduleRows = await expectSuccess(
    STAGE,
    'owner creates a schedule for the leaving worker',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Left Behind ${runId}`,
      p_category: 'weeding',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Task that will be abandoned',
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: 30,
      p_never_expires: false,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );
  const leaveSchedule = firstRpcRow(leaveScheduleRows);

  const openTasksBefore = await countOpenTasks(owner, farm.id);
  assertEqual(STAGE, 'farm has one open task before the worker leaves', openTasksBefore, 1,
    'Precondition failed: the tunggakan assertion below depends on this count.');

  await expectSuccess(
    STAGE,
    'worker leaves the farm',
    worker.client.rpc('leave_current_farm', { p_farm_id: farm.id }),
    'leave_current_farm should release open tasks BEFORE revoking the membership. If this fails with "Care tasks can only be assigned to active workers", the order inside the RPC is wrong.'
  );

  const releasedTask = await getSingle(
    STAGE,
    'abandoned task is released',
    owner.client
      .from('care_tasks')
      .select('id, status, released_at, released_reason, missed_at')
      .eq('id', leaveSchedule.task_id)
      .single(),
    'release_open_tasks_for_member should stamp released_at and released_reason.'
  );
  assertCondition(
    STAGE,
    'released_at is stamped when the worker leaves',
    releasedTask.released_at !== null,
    'Open task of a departed worker was not released.',
    'Check that leave_current_farm calls release_open_tasks_for_member before the membership UPDATE.'
  );
  assertEqual(STAGE, 'release reason records who initiated it', releasedTask.released_reason, 'left_by_worker',
    'released_reason should mirror farm_members.removed_reason.');
  assertEqual(STAGE, 'released task keeps its pending status', releasedTask.status, 'pending',
    'released_at is a separate marker, not a task_status value.');
  assertEqual(STAGE, 'released task is not marked missed', releasedTask.missed_at, null,
    'Released and missed are different causes and must not be conflated.');

  const openTasksAfterLeave = await countOpenTasks(owner, farm.id);
  assertEqual(STAGE, 'released task stops counting as tunggakan', openTasksAfterLeave, 0,
    'The dashboard definition of an open task is: pending/postponed, missed_at null, released_at null.');

  // ---------- 2. Jadwal bisa ditugaskan ulang ----------

  const reassignedTaskId = await expectSuccess(
    STAGE,
    'owner reassigns the schedule to another active worker',
    owner.client.rpc('assign_worker_to_care_schedule', {
      p_schedule_id: leaveSchedule.schedule_id,
      p_worker_id: standbyWorker.userId,
    }),
    'Before migration 051 this failed with "Schedule already has a task": the released row still blocked the schedule.'
  );
  assertCondition(STAGE, 'reassignment returns a new task id', Boolean(reassignedTaskId),
    'assign_worker_to_care_schedule should return the new care_tasks.id.',
    'Check the RPC return value.');
  assertCondition(
    STAGE,
    'reassignment created a different task row',
    reassignedTaskId !== leaveSchedule.task_id,
    'Reassignment reused the released task row instead of creating a new one.',
    'The released row is frozen and must be left alone.'
  );

  const openTasksAfterReassign = await countOpenTasks(owner, farm.id);
  assertEqual(STAGE, 'reassigned task counts as tunggakan again', openTasksAfterReassign, 1,
    'The new task is real work waiting to be done.');

  await expectFailure(
    STAGE,
    'schedule with an active task rejects a second assignment',
    owner.client.rpc('assign_worker_to_care_schedule', {
      p_schedule_id: leaveSchedule.schedule_id,
      p_worker_id: standbyWorker.userId,
    }),
    'The loosening in migration 051 is narrow: only released tasks stop blocking. An active task must still block.'
  );

  // ---------- 3. Mendaftar ulang tidak memunculkan tugas hantu ----------
  //
  // request_join_farm memakai ULANG baris keanggotaan yang sama, jadi user_id
  // pekerja tidak berubah dan tugas lamanya kembali lolos RLS begitu ia aktif.
  const rejoinMembershipId = firstRpcRow(
    await joinWorkerToFarm(STAGE, worker.client, farm.join_code)
  );
  assertEqual(
    STAGE,
    'rejoining reuses the same membership row',
    rejoinMembershipId,
    worker.membershipId,
    'request_join_farm upserts onto the existing row; that reuse is exactly what strands old tasks.'
  );
  await approveWorker(STAGE, owner.client, rejoinMembershipId);

  const visibleToRejoinedWorker = await expectSuccess(
    STAGE,
    'rejoined worker can see the old task row again',
    worker.client
      .from('care_tasks')
      .select('id, released_at')
      .eq('id', leaveSchedule.task_id),
    'RLS lets an active worker read tasks assigned to them, and the released row is still assigned to this user.'
  );
  assertCondition(
    STAGE,
    'RLS alone does not hide the released task',
    visibleToRejoinedWorker.length === 1 && visibleToRejoinedWorker[0].released_at !== null,
    'Expected the released row to be visible but flagged. If it is invisible, this assertion no longer proves that released_at is what hides it.',
    'This is the point: only the released_at filter keeps the ghost task out of the list.'
  );

  const ghostTasks = await expectSuccess(
    STAGE,
    'rejoined worker sees no ghost task in the open list',
    worker.client
      .from('care_tasks')
      .select('id')
      .eq('farm_id', farm.id)
      .eq('assigned_to', worker.userId)
      .in('status', ['pending', 'postponed'])
      .is('missed_at', null)
      .is('released_at', null),
    'This mirrors the query getWorkerTasks uses.'
  );
  assertEqual(STAGE, 'no ghost task after rejoining', ghostTasks.length, 0,
    'A task released when the worker left must not come back when they rejoin.');

  // ---------- 4. Owner mengeluarkan pekerja: perlakuan sama ----------

  const removeScheduleRows = await expectSuccess(
    STAGE,
    'owner creates a schedule for the worker about to be removed',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Removed Worker Task ${runId}`,
      p_category: 'spraying',
      p_scheduled_date: isoDateOffset(3),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Task that will be released by removal',
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: 30,
      p_never_expires: false,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );
  const removeSchedule = firstRpcRow(removeScheduleRows);

  await expectSuccess(
    STAGE,
    'owner removes the worker',
    owner.client.rpc('remove_worker', { p_farm_member_id: rejoinMembershipId }),
    'remove_worker should release open tasks BEFORE revoking the membership.'
  );

  const removedTask = await getSingle(
    STAGE,
    'removal releases the open task too',
    owner.client
      .from('care_tasks')
      .select('id, released_at, released_reason')
      .eq('id', removeSchedule.task_id)
      .single(),
    'Both exit paths must behave the same: the trigger is membership leaving active, not who initiated it.'
  );
  assertCondition(
    STAGE,
    'removal stamps released_at',
    removedTask.released_at !== null,
    'Open task of a removed worker was not released.',
    'Check that remove_worker calls release_open_tasks_for_member before the membership UPDATE.'
  );
  assertEqual(STAGE, 'removal records its own reason', removedTask.released_reason, 'removed_by_owner',
    'released_reason should distinguish removal from voluntary exit.');

  // ---------- 5. Tugas yang sudah selesai tidak ikut dilepas ----------
  //
  // Pelepasan hanya menyentuh tugas TERBUKA. Pekerjaan yang benar-benar sudah
  // dilakukan tidak boleh ikut ditandai lepas, karena itu akan menghapus
  // jejaknya dari hitungan kerja yang selesai.
  const standbyTask = await getSingle(
    STAGE,
    'task of the still-active worker is untouched by the release',
    owner.client
      .from('care_tasks')
      .select('id, released_at, assigned_to')
      .eq('id', reassignedTaskId)
      .single(),
    'The standby worker is still active, so their task must not be released.'
  );
  assertEqual(STAGE, 'active worker task is not released', standbyTask.released_at, null,
    'release_open_tasks_for_member is scoped to the departing member only.');
  assertEqual(STAGE, 'active worker task still belongs to the standby worker', standbyTask.assigned_to,
    standbyWorker.userId,
    'Releasing one member must not reassign anyone else.');
});

// Definisi "tugas terbuka" yang dipakai seluruh penghitung tunggakan sejak
// migrasi 051: pending/postponed, belum terlewat, belum dilepas.
async function countOpenTasks(owner, farmId) {
  const rows = await expectSuccess(
    STAGE,
    'count open tasks in the farm',
    owner.client
      .from('care_tasks')
      .select('id')
      .eq('farm_id', farmId)
      .in('status', ['pending', 'postponed'])
      .is('missed_at', null)
      .is('released_at', null),
    'Active owner should read all care_tasks of their farm.'
  );

  return rows.length;
}
