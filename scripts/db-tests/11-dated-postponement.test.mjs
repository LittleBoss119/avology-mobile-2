import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createIsolatedFarmWithWorker,
  expectFailure,
  expectSuccess,
  firstRpcRow,
  getSingle,
  isoDateOffset,
  makeRunId,
  runStage,
  todayIso,
} from './test-utils.mjs';

// Menguji penundaan bertanggal yang dibangun migrasi 049:
//   - penundaan menggeser care_tasks.due_date ke tanggal penundaan
//   - tanggal lampau dan hari ini ditolak
//   - penundaan tanpa tanggal ditolak
//   - tugas yang sudah terlewat tidak bisa ditunda lagi
//   - mengubah baris jadwal TIDAK ikut menimpa due_date hasil penundaan
//
// Stage berdiri sendiri dengan alasan yang sama seperti stage 10.
//
// BATAS UJI YANG PERLU DIKETAHUI PEMBACA. Butir terakhir di atas hanya menguji
// SEPARUH dari perilaku yang dijanjikan migrasi 049. Yang bisa dibuktikan dari
// sini adalah bahwa database tidak punya trigger yang menimpa due_date ketika
// baris care_schedules berubah. Aturan sebenarnya -- "owner mengedit jadwal
// tanpa mengubah tanggal tidak menarik kembali due_date" -- hidup di
// careScheduleService.updateCareSchedule, yaitu di aplikasi, bukan di database.
// Tidak ada RPC update jadwal yang bisa dipanggil dari sini.

const STAGE = '11 dated postponement';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'postpone',
    workerPhone: '081999002001',
  });

  // ---------- 1. Penundaan menggeser due_date ----------

  const scheduleRows = await expectSuccess(
    STAGE,
    'owner creates schedule due today',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Postpone Subject ${runId}`,
      p_category: 'weeding',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Subject of the dated postponement test',
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: 30,
      p_never_expires: false,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );
  const schedule = firstRpcRow(scheduleRows);

  const postponedUntil = isoDateOffset(21);

  const activityId = await expectSuccess(
    STAGE,
    'worker postpones task with a future date',
    worker.client.rpc('postpone_task', {
      p_task_id: schedule.task_id,
      p_note: 'Menunggu pasokan air',
      p_postponed_until: postponedUntil,
    }),
    'Check postpone_task(p_task_id uuid, p_note text, p_postponed_until date).'
  );
  assertCondition(STAGE, 'postpone_task returns an activity id', Boolean(activityId),
    'postpone_task should return care_activities.id.',
    'Check postpone_task RPC return value.');

  const activity = await getSingle(
    STAGE,
    'postponement stores postponed_until',
    owner.client
      .from('care_activities')
      .select('id, status, postponed_until')
      .eq('id', activityId)
      .single(),
    'care_activities.postponed_until should be filled for postponed rows.'
  );
  assertEqual(STAGE, 'activity status is postponed', activity.status, 'postponed',
    'postpone_task should insert a postponed activity.');
  assertEqual(STAGE, 'activity stores the chosen date', activity.postponed_until, postponedUntil,
    'care_activities_postponed_until_check requires the date on postponed rows.');

  const taskAfterPostpone = await getSingle(
    STAGE,
    'postponement shifts the task due_date',
    owner.client.from('care_tasks').select('id, due_date, status').eq('id', schedule.task_id).single(),
    'sync_task_due_date_from_postponement_trigger should move due_date to postponed_until.'
  );
  assertEqual(STAGE, 'due_date moved to the postponement date', taskAfterPostpone.due_date, postponedUntil,
    'Without this shift a postponed task stays permanently overdue and eventually expires.');
  assertEqual(STAGE, 'task status is postponed', taskAfterPostpone.status, 'postponed',
    'sync_task_status_from_activity should set the task status.');

  // ---------- 2. Tanggal yang ditolak ----------

  await expectFailure(
    STAGE,
    'postponing to today is rejected',
    worker.client.rpc('postpone_task', {
      p_task_id: schedule.task_id,
      p_note: 'Tanggal hari ini',
      p_postponed_until: todayIso(),
    }),
    'postpone_task should reject p_postponed_until <= today: that is not a reschedule.'
  );

  await expectFailure(
    STAGE,
    'postponing to a past date is rejected',
    worker.client.rpc('postpone_task', {
      p_task_id: schedule.task_id,
      p_note: 'Tanggal lampau',
      p_postponed_until: isoDateOffset(-30),
    }),
    'postpone_task should reject p_postponed_until <= today.'
  );

  await expectFailure(
    STAGE,
    'postponing without a date is rejected',
    worker.client.rpc('postpone_task', {
      p_task_id: schedule.task_id,
      p_note: 'Tanpa tanggal',
      p_postponed_until: null,
    }),
    'postpone_task should reject a NULL p_postponed_until with a readable message.'
  );

  await expectFailure(
    STAGE,
    'postponing without a note is still rejected',
    worker.client.rpc('postpone_task', {
      p_task_id: schedule.task_id,
      p_note: '   ',
      p_postponed_until: isoDateOffset(21),
    }),
    'The note requirement from migration 008 must survive migration 049.'
  );

  // ---------- 3. Tugas terlewat tidak bisa ditunda ----------
  //
  // Menunda tugas hangus akan menghidupkan kembali siklus yang penerusnya
  // sudah terlanjur dibuat penyapu.
  const expiredRows = await expectSuccess(
    STAGE,
    'owner creates an already-expired schedule',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Expired Subject ${runId}`,
      p_category: 'watering',
      p_scheduled_date: isoDateOffset(-30),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Task that will be swept as missed',
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: 0,
      p_never_expires: false,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );
  const expired = firstRpcRow(expiredRows);

  await expectSuccess(
    STAGE,
    'owner sweeps so the task becomes missed',
    owner.client.rpc('sweep_missed_schedules', { p_farm_id: farm.id }),
    'Check sweep_missed_schedules(p_farm_id uuid).'
  );

  const missedTask = await getSingle(
    STAGE,
    'task is missed before the postpone attempt',
    owner.client.from('care_tasks').select('id, missed_at').eq('id', expired.task_id).single(),
    'The sweep should have marked this task missed.'
  );
  assertCondition(
    STAGE,
    'sweep marked the task missed',
    missedTask.missed_at !== null,
    'Precondition failed: task was not marked missed, so the next assertion would prove nothing.',
    'Check sweep_missed_schedules 5a and grace_days = 0.'
  );

  await expectFailure(
    STAGE,
    'missed task cannot be postponed',
    worker.client.rpc('postpone_task', {
      p_task_id: expired.task_id,
      p_note: 'Coba tunda tugas hangus',
      p_postponed_until: isoDateOffset(21),
    }),
    'postpone_task should refuse tasks with missed_at set: the chain already moved on.'
  );

  // ---------- 4. Mengubah jadwal tidak menimpa due_date ----------
  //
  // Lihat catatan batas uji di kepala berkas: ini menguji sisi database saja.
  const dueDateBeforeScheduleEdit = taskAfterPostpone.due_date;

  await expectSuccess(
    STAGE,
    'owner edits the schedule without touching its date',
    owner.client
      .from('care_schedules')
      .update({
        title: `Postpone Subject ${runId} (judul diperbaiki)`,
        instruction: 'Instruksi diperbaiki tanpa memindahkan tanggal',
      })
      .eq('id', schedule.schedule_id),
    'Active owner should be able to update their own farm schedules (policy 007:251).'
  );

  const taskAfterScheduleEdit = await getSingle(
    STAGE,
    'schedule edit leaves the postponed due_date alone',
    owner.client.from('care_tasks').select('id, due_date').eq('id', schedule.task_id).single(),
    'No database trigger should rewrite care_tasks.due_date when care_schedules changes.'
  );
  assertEqual(
    STAGE,
    'due_date survives a schedule edit',
    taskAfterScheduleEdit.due_date,
    dueDateBeforeScheduleEdit,
    'Something in the database is pulling due_date back to scheduled_date. Before migration 049 the client did this unconditionally.'
  );
});
