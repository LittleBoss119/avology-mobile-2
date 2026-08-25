import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createIsolatedFarmWithWorker,
  expectSuccess,
  firstRpcRow,
  getSingle,
  isoDateOffset,
  makeRunId,
  runStage,
} from './test-utils.mjs';

// Menguji jalur "terlewat" yang dibangun migrasi 048:
//   - tugas yang lewat masa toleransi mendapat missed_at
//   - jadwal induknya ikut ditandai, dan penerus rantai tetap lahir
//   - rantai tetap maju setelah DUA siklus terlewat berturut-turut
//   - penyapu idempoten: panggilan kedua tidak menambah baris
//   - jadwal tanpa masa toleransi tidak pernah dinyatakan terlewat
//
// Stage ini berdiri sendiri seperti stage 09: seluruh pelaku dan kebunnya
// dibuat di dalam tes. Itu bukan gaya penulisan, melainkan syarat -- stage ini
// menciptakan tugas terlewat dan rantai jadwal, dan kalau dijalankan di kebun
// bersama milik stage 01 ia akan mengubah angka tunggakan yang diperiksa
// stage 06.
//
// CARA MENSIMULASIKAN WAKTU. Tidak ada perjalanan waktu di sini. Yang dipakai
// adalah tanggal jadwal yang sengaja dibuat jauh di masa lalu, karena
// create_manual_schedule tidak menolak p_scheduled_date lampau. Untuk siklus
// terlewat KEDUA, jadwal penerus dan tugasnya dimundurkan lewat UPDATE biasa
// oleh owner (policy 007:286 mengizinkan owner aktif meng-update care_tasks,
// policy 007:251 untuk care_schedules). Itu satu-satunya cara memperoleh dua
// siklus terlewat berturut-turut dalam satu kali jalan, karena
// create_successor_schedule sengaja memajukan tanggal penerus sampai MELEWATI
// hari ini (048:190) sehingga penerus tidak pernah lahir dalam keadaan sudah
// terlambat.

const STAGE = '10 grace period missed sweep';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'missed',
    workerPhone: '081999001001',
  });

  // ---------- 1. Jadwal berulang yang sudah lewat masa toleransi ----------
  //
  // grace_days = 0 berarti "terlewat begitu lewat tanggalnya" -- nilai yang sah
  // menurut care_schedules_grace_days_check dan paling tegas untuk diuji.
  const chainRows = await expectSuccess(
    STAGE,
    'owner creates overdue recurring schedule',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Overdue Chain ${runId}`,
      p_category: 'watering',
      p_scheduled_date: isoDateOffset(-30),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Overdue recurring schedule for missed sweep test',
      p_requires_photo: false,
      p_repeat_every_days: 7,
      p_grace_days: 0,
      p_never_expires: false,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048 (p_grace_days, p_never_expires, p_date_basis).'
  );
  const chain = firstRpcRow(chainRows);

  const taskBeforeSweep = await getSingle(
    STAGE,
    'overdue task starts without missed_at',
    owner.client.from('care_tasks').select('id, missed_at, due_date').eq('id', chain.task_id).single(),
    'care_tasks.missed_at should be NULL until sweep_missed_schedules runs.'
  );
  assertEqual(STAGE, 'task missed_at is null before sweep', taskBeforeSweep.missed_at, null,
    'Nothing but the sweep should set missed_at.');

  // ---------- 2. Sapuan pertama ----------

  await expectSuccess(
    STAGE,
    'owner runs sweep_missed_schedules',
    owner.client.rpc('sweep_missed_schedules', { p_farm_id: farm.id }),
    'Check sweep_missed_schedules(p_farm_id uuid) exists and is granted to authenticated.'
  );

  const taskAfterSweep = await getSingle(
    STAGE,
    'overdue task is marked missed',
    owner.client.from('care_tasks').select('id, missed_at, status').eq('id', chain.task_id).single(),
    'sweep_missed_schedules 5a should set missed_at on tasks past due_date + grace_days.'
  );
  assertCondition(
    STAGE,
    'task gets missed_at after grace period',
    taskAfterSweep.missed_at !== null,
    'Task past due_date + grace_days did not get missed_at.',
    'Check sweep_missed_schedules 5a predicate and care_schedules.grace_days.'
  );
  assertEqual(
    STAGE,
    'missed task keeps its pending status',
    taskAfterSweep.status,
    'pending',
    'missed_at is a separate marker, not a task_status value. Status must not change.'
  );

  const scheduleAfterSweep = await getSingle(
    STAGE,
    'overdue schedule is marked missed',
    owner.client.from('care_schedules').select('id, missed_at, series_id').eq('id', chain.schedule_id).single(),
    'sweep_missed_schedules 5b should mark the parent schedule missed.'
  );
  assertCondition(
    STAGE,
    'schedule gets missed_at after grace period',
    scheduleAfterSweep.missed_at !== null,
    'Parent schedule of a missed task did not get missed_at.',
    'Check sweep_missed_schedules 5b first branch (task with missed_at is not null).'
  );

  const firstSuccessor = await getSingle(
    STAGE,
    'chain produces a successor for the missed cycle',
    owner.client
      .from('care_schedules')
      .select('id, scheduled_date, parent_schedule_id, series_id, grace_days, missed_at')
      .eq('parent_schedule_id', chain.schedule_id)
      .single(),
    'create_successor_schedule should still run for a cycle that was never done. This is the whole point of migration 048.'
  );
  assertEqual(
    STAGE,
    'successor inherits the chain series_id',
    firstSuccessor.series_id,
    scheduleAfterSweep.series_id,
    'Successor must stay in the same chain.'
  );
  assertEqual(STAGE, 'successor inherits grace_days', firstSuccessor.grace_days, 0,
    'grace_days is inherited by the successor (048:203).');
  assertEqual(STAGE, 'successor is born clean', firstSuccessor.missed_at, null,
    'missed_at is deliberately NOT inherited.');
  assertCondition(
    STAGE,
    'successor is dated in the future',
    firstSuccessor.scheduled_date > isoDateOffset(0),
    `Successor scheduled_date ${firstSuccessor.scheduled_date} is not in the future.`,
    'create_successor_schedule advances next_date past today (048:190) so a successor is never born already late.'
  );

  // ---------- 3. Penyapu idempoten ----------

  const schedulesBeforeSecondSweep = await expectSuccess(
    STAGE,
    'count farm schedules before repeat sweep',
    owner.client.from('care_schedules').select('id').eq('farm_id', farm.id),
    'Active owner should read all schedules of their farm.'
  );

  await expectSuccess(
    STAGE,
    'owner runs sweep_missed_schedules a second time',
    owner.client.rpc('sweep_missed_schedules', { p_farm_id: farm.id }),
    'Repeat sweeps must be safe: the function is called from application read paths.'
  );

  const schedulesAfterSecondSweep = await expectSuccess(
    STAGE,
    'count farm schedules after repeat sweep',
    owner.client.from('care_schedules').select('id').eq('farm_id', farm.id),
    'Active owner should read all schedules of their farm.'
  );
  assertEqual(
    STAGE,
    'repeat sweep does not create extra schedules',
    schedulesAfterSecondSweep.length,
    schedulesBeforeSecondSweep.length,
    'The idempotency guard in create_successor_schedule (parent_schedule_id already exists) leaked.'
  );

  // ---------- 4. Dua siklus terlewat berturut-turut ----------
  //
  // Penerus dimundurkan ke masa lalu supaya siklus KEDUA juga lewat masa
  // toleransi. Tugasnya ikut dimundurkan, karena cabang pertama 5b menuntut
  // adanya tugas yang sudah ditandai terlewat.
  await expectSuccess(
    STAGE,
    'owner back-dates the successor schedule',
    owner.client
      .from('care_schedules')
      .update({ scheduled_date: isoDateOffset(-21) })
      .eq('id', firstSuccessor.id),
    'Active owner should be able to update their own farm schedules (policy 007:251).'
  );

  const successorTask = await getSingle(
    STAGE,
    'successor carries a task for the still-active worker',
    owner.client
      .from('care_tasks')
      .select('id, due_date, missed_at')
      .eq('care_schedule_id', firstSuccessor.id)
      .single(),
    'The successor should carry a task because the worker is still active (048:227).'
  );

  await expectSuccess(
    STAGE,
    'owner back-dates the successor task',
    owner.client
      .from('care_tasks')
      .update({ due_date: isoDateOffset(-21) })
      .eq('id', successorTask.id),
    'Active owner should be able to update care_tasks of their farm (policy 007:286).'
  );

  await expectSuccess(
    STAGE,
    'owner sweeps after the second cycle also expired',
    owner.client.rpc('sweep_missed_schedules', { p_farm_id: farm.id }),
    'Check sweep_missed_schedules(p_farm_id uuid).'
  );

  const successorAfterSweep = await getSingle(
    STAGE,
    'second cycle is marked missed too',
    owner.client.from('care_schedules').select('id, missed_at').eq('id', firstSuccessor.id).single(),
    'A second consecutive overdue cycle should also be marked missed.'
  );
  assertCondition(
    STAGE,
    'second consecutive cycle gets missed_at',
    successorAfterSweep.missed_at !== null,
    'Second cycle did not get missed_at.',
    'Check sweep_missed_schedules 5b.'
  );

  const secondSuccessor = await getSingle(
    STAGE,
    'chain keeps advancing after two consecutive missed cycles',
    owner.client
      .from('care_schedules')
      .select('id, scheduled_date, parent_schedule_id')
      .eq('parent_schedule_id', firstSuccessor.id)
      .single(),
    'This is the failure migration 048 was written to fix: version 041 stalled permanently after exactly one missed cycle.'
  );
  assertCondition(
    STAGE,
    'third cycle is dated in the future',
    secondSuccessor.scheduled_date > isoDateOffset(0),
    `Third cycle scheduled_date ${secondSuccessor.scheduled_date} is not in the future.`,
    'create_successor_schedule advances next_date past today.'
  );

  // ---------- 5. Jadwal tanpa masa toleransi tidak pernah terlewat ----------

  const neverExpiresRows = await expectSuccess(
    STAGE,
    'owner creates an overdue schedule that never expires',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Never Expires ${runId}`,
      p_category: 'other',
      p_scheduled_date: isoDateOffset(-30),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'farm',
      p_target_tree_id: null,
      p_custom_target_note: null,
      p_instruction: 'Schedule without grace period',
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: null,
      p_never_expires: true,
      p_date_basis: 'jadwal',
    }),
    'p_never_expires should store grace_days as NULL.'
  );
  const neverExpires = firstRpcRow(neverExpiresRows);

  await expectSuccess(
    STAGE,
    'owner sweeps with a never-expiring schedule present',
    owner.client.rpc('sweep_missed_schedules', { p_farm_id: farm.id }),
    'Check sweep_missed_schedules(p_farm_id uuid).'
  );

  const neverExpiresTask = await getSingle(
    STAGE,
    'never-expiring schedule keeps its task open',
    owner.client.from('care_tasks').select('id, missed_at').eq('id', neverExpires.task_id).single(),
    'A schedule without grace_days must never be declared missed, no matter how old it is.'
  );
  assertEqual(STAGE, 'task of a never-expiring schedule stays unmissed', neverExpiresTask.missed_at, null,
    'sweep_missed_schedules requires s.grace_days is not null.');

  // Bagian 6 lama -- "tugas laporan operasional tidak pernah terlewat" --
  // dibuang bersama modul laporan (migrasi 053). Kasusnya sendiri sudah tidak
  // mungkin terjadi: constraint care_tasks_source_check yang baru mewajibkan
  // care_schedule_id terisi, jadi tidak ada lagi tugas tanpa jadwal induk yang
  // bisa lolos dari join di 5a.
});
