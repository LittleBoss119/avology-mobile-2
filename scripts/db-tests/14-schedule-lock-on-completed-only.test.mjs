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

// Menguji pelonggaran penguncian jadwal yang dibangun migrasi 052:
//   - jadwal yang tugasnya TERTUNDA masih bisa dibatalkan
//   - jadwal yang tugasnya SELESAI tetap tidak bisa dibatalkan
//   - jadwal yang tugasnya dilepas (051) masih bisa dibatalkan
//   - "hentikan pengulangan" tidak ikut terkunci oleh hasil kerja selesai
//
// CATATAN LINGKUP. Stage ini TIDAK ada di daftar empat jalur yang diminta,
// tetapi judul permintaannya menyebut rentang 048-052. Tanpa stage ini,
// migrasi 052 adalah satu-satunya dari rentang itu yang tidak punya tes sama
// sekali, padahal ia memperbaiki jalan buntu yang terkonfirmasi di perangkat.
//
// Yang diuji di sini hanya penjaga di sisi DATABASE, yaitu cancel_care_schedule.
// Aturan kembar di getScheduleEditEligibility dan pada tombol layar detail
// jadwal hidup di aplikasi dan tidak terjangkau dari jalur PostgREST ini.

const STAGE = '14 schedule lock on completed only';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'lock',
    workerPhone: '081999005001',
  });

  // ---------- 1. Tugas tertunda TIDAK mengunci jadwal ----------

  const postponed = await createSchedule(owner, worker, farm.id, `Postponed Lock ${runId}`, 'watering');

  await expectSuccess(
    STAGE,
    'worker postpones the task',
    worker.client.rpc('postpone_task', {
      p_task_id: postponed.task_id,
      p_note: 'Ditunda dulu',
      p_postponed_until: isoDateOffset(21),
    }),
    'Check postpone_task(p_task_id, p_note, p_postponed_until).'
  );

  const postponedActivities = await expectSuccess(
    STAGE,
    'postponement really wrote an activity row',
    owner.client.from('care_activities').select('id, status').eq('care_task_id', postponed.task_id),
    'Active owner should read care_activities of their farm.'
  );
  assertCondition(
    STAGE,
    'schedule now has an activity row',
    postponedActivities.length === 1 && postponedActivities[0].status === 'postponed',
    'Precondition failed: without an activity row the next assertion proves nothing.',
    'Before migration 052 the mere existence of this row was enough to lock the schedule.'
  );

  await expectSuccess(
    STAGE,
    'schedule with a postponed task can still be cancelled',
    owner.client.rpc('cancel_care_schedule', {
      p_schedule_id: postponed.schedule_id,
      p_reason: 'Dibatalkan meski tugasnya tertunda',
    }),
    'This is the dead end migration 052 fixed: a postponed task used to block both edit and cancel, leaving the owner with no action at all.'
  );

  const cancelledSchedule = await getSingle(
    STAGE,
    'cancellation is recorded',
    owner.client
      .from('care_schedules')
      .select('id, is_cancelled, cancel_reason')
      .eq('id', postponed.schedule_id)
      .single(),
    'cancel_care_schedule should set is_cancelled with its reason.'
  );
  assertEqual(STAGE, 'schedule is cancelled', cancelledSchedule.is_cancelled, true,
    'cancel_care_schedule should set is_cancelled true.');

  // ---------- 2. Tugas selesai TETAP mengunci jadwal ----------
  //
  // Pelonggaran 052 sesempit mungkin. Kalau assertion ini gagal, penjaganya
  // kebablasan dan riwayat kerja jadi bisa dipalsukan.
  const completed = await createSchedule(owner, worker, farm.id, `Completed Lock ${runId}`, 'spraying');

  await expectSuccess(
    STAGE,
    'worker completes the task',
    worker.client.rpc('complete_task', {
      p_task_id: completed.task_id,
      p_note: 'Sudah dikerjakan',
    }),
    'Check complete_task(p_task_id, p_note, p_produk, p_produk_jumlah, p_produk_satuan).'
  );

  await expectFailure(
    STAGE,
    'schedule with completed work cannot be cancelled',
    owner.client.rpc('cancel_care_schedule', {
      p_schedule_id: completed.schedule_id,
      p_reason: 'Seharusnya ditolak',
    }),
    'Real work must stay protected: editing or cancelling its schedule would make old records describe an order that was never given.'
  );

  // ---------- 3. Tunda lalu selesai tetap mengunci ----------

  const both = await createSchedule(owner, worker, farm.id, `Postponed Then Done ${runId}`, 'fertilizing');

  await expectSuccess(
    STAGE,
    'worker postpones then completes the same task',
    worker.client.rpc('postpone_task', {
      p_task_id: both.task_id,
      p_note: 'Ditunda sebentar',
      p_postponed_until: isoDateOffset(21),
    }),
    'Check postpone_task(p_task_id, p_note, p_postponed_until).'
  );
  await expectSuccess(
    STAGE,
    'worker completes the postponed task',
    worker.client.rpc('complete_task', {
      p_task_id: both.task_id,
      p_note: 'Akhirnya dikerjakan',
    }),
    'A postponed task may still be completed; that is the normal flow.'
  );

  await expectFailure(
    STAGE,
    'a completed row locks the schedule even alongside a postponed row',
    owner.client.rpc('cancel_care_schedule', {
      p_schedule_id: both.schedule_id,
      p_reason: 'Seharusnya ditolak',
    }),
    'The guard asks whether ANY activity is completed, not what the latest one is.'
  );

  // ---------- 4. Hentikan pengulangan tidak ikut terkunci ----------
  //
  // Dijalankan SEBELUM pekerja keluar: create_manual_schedule menolak
  // penugasan ke anggota non-aktif, jadi urutannya tidak bisa dibalik.
  const recurring = await createSchedule(
    owner,
    worker,
    farm.id,
    `Recurring Lock ${runId}`,
    'watering',
    { repeatEveryDays: 7 }
  );

  await expectSuccess(
    STAGE,
    'worker completes the recurring task',
    worker.client.rpc('complete_task', {
      p_task_id: recurring.task_id,
      p_note: 'Siklus pertama selesai',
    }),
    'Check complete_task(p_task_id, p_note, p_produk, p_produk_jumlah, p_produk_satuan).'
  );

  await expectFailure(
    STAGE,
    'recurring schedule with completed work cannot be cancelled either',
    owner.client.rpc('cancel_care_schedule', {
      p_schedule_id: recurring.schedule_id,
      p_reason: 'Seharusnya ditolak',
    }),
    'Being recurring does not exempt a schedule from the completed-work lock.'
  );

  await expectSuccess(
    STAGE,
    'owner stops repetition on a schedule that already has completed work',
    owner.client.rpc('stop_care_schedule_repeat', { p_schedule_id: recurring.schedule_id }),
    'Stopping the chain is deliberately NOT locked: a schedule that has been worked on is exactly when an owner wants to stop it.'
  );

  const stoppedSchedule = await getSingle(
    STAGE,
    'repetition is stopped',
    owner.client
      .from('care_schedules')
      .select('id, repeat_every_days, is_cancelled')
      .eq('id', recurring.schedule_id)
      .single(),
    'stop_care_schedule_repeat should clear repeat_every_days.'
  );
  assertEqual(STAGE, 'repeat_every_days is cleared', stoppedSchedule.repeat_every_days, null,
    'stop_care_schedule_repeat should set repeat_every_days to NULL.');
  assertEqual(STAGE, 'stopping repetition does not cancel the schedule', stoppedSchedule.is_cancelled, false,
    'Stopping the chain and cancelling the schedule are different actions and must not be confused.');

  // ---------- 5. Jadwal yang tugasnya dilepas masih bisa dibatalkan ----------
  //
  // Tugas terlepas berstatus pending atau postponed, jadi ia tidak pernah punya
  // aktivitas selesai. Perpotongan 051 dan 052 ini yang paling mudah terlewat.
  //
  // Blok ini WAJIB terakhir: pekerjanya keluar di sini, dan setelah itu tidak
  // ada lagi jadwal yang bisa dibuat untuknya.
  const released = await createSchedule(owner, worker, farm.id, `Released Lock ${runId}`, 'weeding');

  await expectSuccess(
    STAGE,
    'worker postpones the task before leaving',
    worker.client.rpc('postpone_task', {
      p_task_id: released.task_id,
      p_note: 'Ditunda sebelum keluar',
      p_postponed_until: isoDateOffset(21),
    }),
    'Check postpone_task(p_task_id, p_note, p_postponed_until).'
  );

  await expectSuccess(
    STAGE,
    'worker leaves the farm',
    worker.client.rpc('leave_current_farm', { p_farm_id: farm.id }),
    'leave_current_farm should release open tasks, including postponed ones.'
  );

  const releasedTask = await getSingle(
    STAGE,
    'postponed task was released on exit',
    owner.client.from('care_tasks').select('id, released_at').eq('id', released.task_id).single(),
    'release_open_tasks_for_member covers both pending and postponed tasks.'
  );
  assertCondition(
    STAGE,
    'postponed task is released when the worker leaves',
    releasedTask.released_at !== null,
    'Precondition failed: the released task was not stamped.',
    'Check release_open_tasks_for_member status filter.'
  );

  await expectSuccess(
    STAGE,
    'schedule of a released postponed task can be cancelled',
    owner.client.rpc('cancel_care_schedule', {
      p_schedule_id: released.schedule_id,
      p_reason: 'Pekerjanya keluar, jadwal dibatalkan',
    }),
    'A released task carries only a postponed activity, so it must never lock the schedule.'
  );
});

async function createSchedule(owner, worker, farmId, title, category, options = {}) {
  const rows = await expectSuccess(
    STAGE,
    `owner creates schedule ${title}`,
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farmId,
      p_title: title,
      p_category: category,
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: `Instruction for ${title}`,
      p_requires_photo: false,
      p_repeat_every_days: options.repeatEveryDays ?? null,
      p_grace_days: null,
      p_never_expires: true,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );

  return firstRpcRow(rows);
}
