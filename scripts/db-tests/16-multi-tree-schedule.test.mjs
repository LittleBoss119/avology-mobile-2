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

// Menguji jadwal banyak pohon dan penyaringan siklus tanam yang dibangun
// migrasi 057:
//   - satu jadwal menyasar N pohon lewat care_schedule_trees, terbaca utuh
//   - kolom bayangan target_tree_id terisi pohon BERKODE TERKECIL dari N itu
//   - pohon tanpa siklus tanam aktif ditolak masuk jadwal baru
//   - campuran sah/tidak sah: jadwal TETAP jadi untuk yang sah, sisanya
//     dilaporkan balik dalam bahasa Indonesia
//   - seluruhnya tidak sah: gagal dengan pesan yang jelas
//   - complete_task menghasilkan TEPAT SATU baris care_activities dan N baris
//     care_activity_trees -- BUKAN N aktivitas
//   - pohon yang siklusnya ditutup di tengah rantai rontok dari jadwal PENERUS,
//     bukan dari jadwal yang sedang berjalan
//   - saat seluruh pohon rontok, rantai berhenti bersih: penerus tidak lahir
//     dan penyelesaian tugas tetap berhasil
//
// Stage ini berdiri sendiri seperti stage 09, 10, 14, dan 15: seluruh pelaku dan
// kebunnya dibuat di dalam tes. Itu syarat, bukan gaya -- stage ini menutup
// siklus tanam beberapa pohon, dan kalau dijalankan di kebun bersama milik stage
// 01 ia akan mengubah angka yang diperiksa stage 06 dan mematikan pohon yang
// dipakai stage 04 dan 12.

const STAGE = '16 multi tree schedule';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'multitree',
    workerPhone: '081999007001',
  });

  // Membuat pohon berikut siklus tanam pertamanya. Urutan pembuatan SENGAJA
  // tidak sama dengan urutan kodenya -- pohon berkode terkecil (1-A) dibuat
  // TERAKHIR, supaya pemeriksaan kolom bayangan di bawah benar-benar menguji
  // pengurutan dan bukan kebetulan "yang pertama dibuat".
  async function createTree(operation, rowPosition, columnPosition) {
    return expectSuccess(
      STAGE,
      operation,
      owner.client.rpc('create_tree_with_planting', {
        p_farm_id: farm.id,
        p_row_position: rowPosition,
        p_column_position: columnPosition,
        p_variety: 'Alpukat Mentega',
        p_planted_at: isoDateOffset(-60),
      }),
      'Check create_tree_with_planting(uuid, smallint, text, text, date).'
    );
  }

  const treeC = await createTree('owner creates tree 1-C', 1, 'C');
  const treeB = await createTree('owner creates tree 1-B', 1, 'B');
  const treeA = await createTree('owner creates tree 1-A', 1, 'A');

  async function createSchedule(operation, { title, treeIds, repeatEveryDays = null }) {
    return expectSuccess(
      STAGE,
      operation,
      owner.client.rpc('create_manual_schedule', {
        p_farm_id: farm.id,
        p_title: title,
        p_category: 'watering',
        p_scheduled_date: todayIso(),
        p_assigned_worker_id: worker.userId,
        p_target_type: 'tree',
        p_target_tree_ids: treeIds,
        p_custom_target_note: null,
        p_instruction: 'Siram pohonnya',
        p_repeat_every_days: repeatEveryDays,
      }),
      'Check create_manual_schedule after migration 057 (p_target_tree_ids uuid[]).'
    );
  }

  async function bridgeTreeIds(operation, scheduleId) {
    const rows = await expectSuccess(
      STAGE,
      operation,
      owner.client
        .from('care_schedule_trees')
        .select('tree_id')
        .eq('schedule_id', scheduleId),
      'care_schedule_trees is the source of truth for a tree-targeted schedule.'
    );

    return (rows ?? []).map((row) => row.tree_id).sort();
  }

  // ---------- 1. Jadwal banyak pohon terbentuk dan terbaca utuh ----------

  const multi = firstRpcRow(
    await createSchedule('owner creates a schedule for three trees', {
      title: `Siram tiga pohon ${runId}`,
      treeIds: [treeC, treeA, treeB],
    })
  );

  assertCondition(
    STAGE,
    'multi tree schedule returns schedule_id and task_id',
    Boolean(multi?.schedule_id && multi?.task_id),
    'create_manual_schedule did not return schedule_id/task_id.',
    'Check the RPC return table definition in migration 057.'
  );

  assertEqual(
    STAGE,
    'all three trees are accepted',
    multi.scheduled_tree_ids?.length,
    3,
    'scheduled_tree_ids should list every tree that made it into the schedule.'
  );

  assertEqual(
    STAGE,
    'nothing is rejected when every tree is planted',
    multi.rejected_tree_ids?.length ?? 0,
    0,
    'All three trees have an active planting cycle, so none may be rejected.'
  );

  assertCondition(
    STAGE,
    'no rejection message when nothing is rejected',
    multi.rejected_message === null || multi.rejected_message === undefined,
    `Expected no rejection message, got ${JSON.stringify(multi.rejected_message)}.`,
    'rejected_message must stay null when the whole selection is valid.'
  );

  assertEqual(
    STAGE,
    'bridge table holds all three trees',
    (await bridgeTreeIds('schedule trees are readable', multi.schedule_id)).join(','),
    [treeA, treeB, treeC].sort().join(','),
    'care_schedule_trees should hold one row per targeted tree.'
  );

  const multiSchedule = await getSingle(
    STAGE,
    'schedule row exists with its shadow target',
    owner.client
      .from('care_schedules')
      .select('id, target_type, target_tree_id')
      .eq('id', multi.schedule_id)
      .single(),
    'The schedule row must still satisfy care_schedules_target_check.'
  );

  // Bayangan = pohon berkode terkecil, diurutkan menurut (row_position,
  // column_position). 1-A menang atas 1-B dan 1-C.
  assertEqual(
    STAGE,
    'shadow column holds the lowest tree code',
    multiSchedule.target_tree_id,
    treeA,
    'target_tree_id is a shadow of the bridge: the lowest-coded tree of the set.'
  );

  const multiTask = await getSingle(
    STAGE,
    'task inherits the same shadow target',
    owner.client
      .from('care_tasks')
      .select('id, care_schedule_id, target_type, target_tree_id')
      .eq('id', multi.task_id)
      .single(),
    'The task reaches its trees through care_schedule_id, not through this column.'
  );
  assertEqual(
    STAGE,
    'task points back at its schedule',
    multiTask.care_schedule_id,
    multi.schedule_id,
    'complete_task resolves the tree list through care_tasks.care_schedule_id.'
  );
  assertEqual(
    STAGE,
    'task shadow matches the schedule shadow',
    multiTask.target_tree_id,
    treeA,
    'Both shadows must agree so care_tasks_target_check stays satisfied.'
  );

  // ---------- 2. Pohon tanpa siklus aktif ditolak saat pembuatan ----------

  const emptyPosition = await createTree('owner creates tree 2-A', 2, 'A');

  await expectSuccess(
    STAGE,
    'owner closes the cycle at position 2-A',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: emptyPosition,
      p_end_reason: 'mati',
      p_ended_at: todayIso(),
    }),
    'Check end_tree_planting(uuid, text, date) from migration 055.'
  );

  const mixed = firstRpcRow(
    await createSchedule('owner creates a schedule from a mixed selection', {
      title: `Campuran ${runId}`,
      treeIds: [treeA, emptyPosition],
    })
  );

  assertEqual(
    STAGE,
    'mixed selection keeps only the planted tree',
    mixed.scheduled_tree_ids?.length,
    1,
    'A position whose cycle is closed must not enter a new schedule.'
  );
  assertEqual(
    STAGE,
    'mixed selection reports the rejected tree',
    mixed.rejected_tree_ids?.length,
    1,
    'Rejected trees must be reported back, not silently dropped.'
  );
  assertCondition(
    STAGE,
    'rejection message is written in Indonesian and names the tree code',
    typeof mixed.rejected_message === 'string' && mixed.rejected_message.includes('2-A'),
    `Expected a message naming 2-A, got ${JSON.stringify(mixed.rejected_message)}.`,
    'Messages the owner reads are written in Indonesian and name the tree by code.'
  );
  assertEqual(
    STAGE,
    'bridge holds only the accepted tree',
    (await bridgeTreeIds('mixed schedule trees are readable', mixed.schedule_id)).join(','),
    treeA,
    'Only trees with an active planting cycle belong in the bridge.'
  );

  await expectFailure(
    STAGE,
    'a selection with no planted tree at all is rejected',
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farm.id,
      p_title: `Semua kosong ${runId}`,
      p_category: 'watering',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: worker.userId,
      p_target_type: 'tree',
      p_target_tree_ids: [emptyPosition],
      p_custom_target_note: null,
      p_instruction: 'Tidak boleh jadi',
    }),
    'A schedule with zero valid trees must fail loudly, not create an empty schedule.'
  );

  // ---------- 3. complete_task: SATU aktivitas, N tautan pohon ----------
  //
  // Ini yang paling mungkin salah dipahami sesi berikutnya. Jadwal tiga pohon
  // TIDAK menghasilkan tiga baris care_activities -- ia menghasilkan satu
  // aktivitas dengan tiga tautan pohon, persis seperti cabang 'farm' sejak 050.

  const multiActivityId = await expectSuccess(
    STAGE,
    'worker completes the three tree task once',
    worker.client.rpc('complete_task', {
      p_task_id: multi.task_id,
      p_note: 'Sudah disiram semua',
    }),
    'Check complete_task(uuid, text, text, numeric, text).'
  );

  const multiActivities = await expectSuccess(
    STAGE,
    'completing once writes exactly one care_activities row',
    owner.client.from('care_activities').select('id').eq('care_task_id', multi.task_id),
    'complete_task must stay one activity per task -- update_task_realization and rollback_completed_task_activity both assume it.'
  );
  assertEqual(
    STAGE,
    'one task completion is one activity, never N',
    multiActivities?.length,
    1,
    'N activities would freeze all but the newest for correction and would break rollback.'
  );

  const multiLinks = await expectSuccess(
    STAGE,
    'the single activity links every tree in the schedule',
    owner.client
      .from('care_activity_trees')
      .select('tree_id')
      .eq('care_activity_id', multiActivityId),
    'Per-tree history comes from care_activity_trees, which tree_history_view reads.'
  );
  assertEqual(
    STAGE,
    'three trees linked to one activity',
    (multiLinks ?? []).map((row) => row.tree_id).sort().join(','),
    [treeA, treeB, treeC].sort().join(','),
    'complete_task should resolve trees from care_schedule_trees via care_schedule_id.'
  );

  // ---------- 4. Pohon rontok dari jadwal PENERUS, bukan dari yang berjalan ----------

  const chain = firstRpcRow(
    await createSchedule('owner creates a recurring schedule for three trees', {
      title: `Rantai tiga pohon ${runId}`,
      treeIds: [treeA, treeB, treeC],
      repeatEveryDays: 7,
    })
  );

  await expectSuccess(
    STAGE,
    'worker completes the first cycle of the chain',
    worker.client.rpc('complete_task', { p_task_id: chain.task_id, p_note: 'Siklus 1' }),
    'Completing a recurring task fires zz_create_next_recurring_schedule_trigger.'
  );

  const successorOne = await getSingle(
    STAGE,
    'successor schedule is born',
    owner.client
      .from('care_schedules')
      .select('id, target_tree_id, parent_schedule_id')
      .eq('parent_schedule_id', chain.schedule_id)
      .single(),
    'create_successor_schedule should produce exactly one successor.'
  );
  assertEqual(
    STAGE,
    'successor inherits all three trees',
    (await bridgeTreeIds('successor trees are readable', successorOne.id)).join(','),
    [treeA, treeB, treeC].sort().join(','),
    'Nothing has been closed yet, so every tree carries over.'
  );

  const successorOneTask = await getSingle(
    STAGE,
    'successor carries a task for the same worker',
    owner.client
      .from('care_tasks')
      .select('id, assigned_to')
      .eq('care_schedule_id', successorOne.id)
      .single(),
    'The successor task is created only while the worker is still active.'
  );

  // Tutup siklus 1-C DI TENGAH rantai.
  await expectSuccess(
    STAGE,
    'owner closes the cycle of tree 1-C mid chain',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeC,
      p_end_reason: 'dibongkar',
      p_ended_at: todayIso(),
    }),
    'Check end_tree_planting(uuid, text, date).'
  );

  // Jadwal yang SEDANG BERJALAN tidak berubah -- itu fakta tersimpan.
  assertEqual(
    STAGE,
    'closing a cycle does not rewrite the running schedule',
    (await bridgeTreeIds('running schedule trees are unchanged', successorOne.id)).join(','),
    [treeA, treeB, treeC].sort().join(','),
    'Filtering happens on write into the SUCCESSOR, never retroactively.'
  );

  await expectSuccess(
    STAGE,
    'worker completes the second cycle of the chain',
    worker.client.rpc('complete_task', { p_task_id: successorOneTask.id, p_note: 'Siklus 2' }),
    'Completing this task should produce the next successor.'
  );

  const successorTwo = await getSingle(
    STAGE,
    'second successor is born',
    owner.client
      .from('care_schedules')
      .select('id, target_tree_id')
      .eq('parent_schedule_id', successorOne.id)
      .single(),
    'The chain must keep moving while at least one tree survives.'
  );
  assertEqual(
    STAGE,
    'the closed tree drops out of the successor',
    (await bridgeTreeIds('second successor trees are readable', successorTwo.id)).join(','),
    [treeA, treeB].sort().join(','),
    'A position without an active planting cycle must not be scheduled again.'
  );
  assertEqual(
    STAGE,
    'successor shadow follows the surviving set',
    successorTwo.target_tree_id,
    treeA,
    'The shadow is recomputed from the survivors, not copied from the parent.'
  );

  // Kerja yang BENAR-BENAR dilakukan pada siklus 2 tetap menempel di ketiga
  // pohon, termasuk yang siklusnya sudah ditutup sesudahnya.
  const secondCycleActivity = await getSingle(
    STAGE,
    'second cycle activity exists',
    owner.client
      .from('care_activities')
      .select('id')
      .eq('care_task_id', successorOneTask.id)
      .single(),
    'One completion is one activity.'
  );
  const secondCycleLinks = await expectSuccess(
    STAGE,
    'work already done stays linked to the closed tree',
    owner.client
      .from('care_activity_trees')
      .select('tree_id')
      .eq('care_activity_id', secondCycleActivity.id),
    'complete_task links what was actually worked on, it does not re-filter history.'
  );
  assertEqual(
    STAGE,
    'the closed tree keeps the work recorded against it',
    (secondCycleLinks ?? []).map((row) => row.tree_id).sort().join(','),
    [treeA, treeB, treeC].sort().join(','),
    'Closing a cycle afterwards must not erase work that really happened.'
  );

  // ---------- 5. Rantai berhenti bersih saat seluruh pohon rontok ----------

  const successorTwoTask = await getSingle(
    STAGE,
    'third cycle carries a task',
    owner.client
      .from('care_tasks')
      .select('id')
      .eq('care_schedule_id', successorTwo.id)
      .single(),
    'The chain still has a task to complete.'
  );

  for (const [treeId, label] of [[treeA, '1-A'], [treeB, '1-B']]) {
    await expectSuccess(
      STAGE,
      `owner closes the cycle of tree ${label}`,
      owner.client.rpc('end_tree_planting', {
        p_tree_id: treeId,
        p_end_reason: 'mati',
        p_ended_at: todayIso(),
      }),
      'Check end_tree_planting(uuid, text, date).'
    );
  }

  // Penyelesaian tugas HARUS tetap berhasil. Rantai yang berhenti bukan galat,
  // dan pekerja tidak boleh melihat kegagalan untuk pekerjaan yang sungguh
  // sudah dia lakukan.
  const lastActivityId = await expectSuccess(
    STAGE,
    'worker completes the last cycle even though every tree is gone',
    worker.client.rpc('complete_task', { p_task_id: successorTwoTask.id, p_note: 'Siklus 3' }),
    'A chain that stops must not raise -- it would kill the completion and the sweep.'
  );

  assertCondition(
    STAGE,
    'the last completion still recorded an activity',
    Boolean(lastActivityId),
    'complete_task returned no activity id.',
    'Completion must succeed independently of whether a successor is born.'
  );

  const noSuccessor = await expectSuccess(
    STAGE,
    'no successor is born when every tree has dropped out',
    owner.client
      .from('care_schedules')
      .select('id')
      .eq('parent_schedule_id', successorTwo.id),
    'create_successor_schedule should return null, not raise and not insert.'
  );
  assertEqual(
    STAGE,
    'the chain stops cleanly',
    noSuccessor?.length ?? 0,
    0,
    'With no tree left to care for, the chain ends -- that is a normal stop, not a failure.'
  );

  // ---------- 6. Jadwal SE-KEBUN melewati posisi tanpa siklus tanam (migrasi 058) ----------
  //
  // Sampai 057, cabang target_type = 'farm' di complete_task menautkan SELURUH
  // pohon kebun yang tidak terarsip tanpa memeriksa siklus tanam -- sehingga
  // posisi yang tidak ada pohonnya ikut tercatat menerima perawatan, permanen,
  // karena care_activity_trees tidak punya jalur DELETE.

  async function farmActivityTreeIds(operation, activityId) {
    const rows = await expectSuccess(
      STAGE,
      operation,
      owner.client.from('care_activity_trees').select('tree_id').eq('care_activity_id', activityId),
      'care_activity_trees is what tree_history_view reads for care rows.'
    );

    return (rows ?? []).map((row) => row.tree_id).sort();
  }

  async function createFarmSchedule(operation, title) {
    return expectSuccess(
      STAGE,
      operation,
      owner.client.rpc('create_manual_schedule', {
        p_farm_id: farm.id,
        p_title: title,
        p_category: 'watering',
        p_scheduled_date: todayIso(),
        p_assigned_worker_id: worker.userId,
        p_target_type: 'farm',
        p_target_tree_id: null,
        p_custom_target_note: null,
        p_instruction: 'Siram seluruh kebun',
      }),
      'create_manual_schedule must keep accepting target_type = farm unchanged.'
    );
  }

  // Pada titik ini SELURUH posisi kebun ini siklusnya sudah ditutup: 2-A di
  // bagian 2, 1-C di bagian 4, lalu 1-A dan 1-B di bagian 5. Satu posisi
  // ditanami ulang supaya kebunnya benar-benar CAMPURAN -- satu berpohon, tiga
  // kosong -- karena itulah keadaan yang membedakan perilaku lama dan baru.
  await expectSuccess(
    STAGE,
    'owner replants position 1-A',
    owner.client.rpc('start_tree_planting', {
      p_tree_id: treeA,
      p_variety: 'Alpukat Aligator',
      p_planted_at: todayIso(),
    }),
    'Check start_tree_planting(uuid, text, date) from migration 055.'
  );

  const farmMixed = firstRpcRow(
    await createFarmSchedule('owner creates a farm-wide schedule', `Se-kebun campuran ${runId}`)
  );

  const farmMixedActivityId = await expectSuccess(
    STAGE,
    'worker completes the farm-wide task in a mixed farm',
    worker.client.rpc('complete_task', { p_task_id: farmMixed.task_id, p_note: 'Se-kebun campuran' }),
    'complete_task must not raise for target_type = farm.'
  );

  assertEqual(
    STAGE,
    'farm-wide work links only the position that still has a tree',
    (await farmActivityTreeIds('farm-wide links are readable', farmMixedActivityId)).join(','),
    treeA,
    'A position whose planting cycle is closed has no tree to care for -- it must not be linked.'
  );

  // ---------- 6b. Cabang 'tree' TIDAK ikut berubah ----------
  //
  // Pagar arah sebaliknya. Penyaringan siklus milik cabang 'farm' saja; kalau
  // ia bocor ke cabang 'tree', pekerjaan yang benar-benar dilakukan akan hilang
  // dari riwayat setiap kali pemilik menutup siklus belakangan.
  //
  // Bersaudara dengan asersi 'the closed tree keeps the work recorded against
  // it' di bagian 4 -- yang itu menutup rantai berulang, yang ini menutup
  // jadwal sekali jalan yang siklusnya ditutup SETELAH jadwalnya dibuat.
  const treeAfterFix = firstRpcRow(
    await createSchedule('owner creates a tree schedule on the replanted position', {
      title: `Pohon setelah 058 ${runId}`,
      treeIds: [treeA],
    })
  );

  await expectSuccess(
    STAGE,
    'owner closes the cycle of position 1-A again',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeA,
      p_end_reason: 'dibongkar',
      p_ended_at: todayIso(),
    }),
    'Check end_tree_planting(uuid, text, date).'
  );

  const treeAfterFixActivityId = await expectSuccess(
    STAGE,
    'worker completes the tree task after its cycle was closed',
    worker.client.rpc('complete_task', { p_task_id: treeAfterFix.task_id, p_note: 'Pohon' }),
    'The tree branch reads care_schedule_trees as-is; it does not re-filter at completion.'
  );

  assertEqual(
    STAGE,
    'the tree branch still links a tree whose cycle has since closed',
    (await farmActivityTreeIds('tree branch links are readable', treeAfterFixActivityId)).join(','),
    treeA,
    'Filtering belongs where the tree set is CHOSEN, not where the work is recorded.'
  );

  // ---------- 7. Kebun yang seluruh posisinya kosong ----------
  //
  // 1-A baru saja ditutup lagi di 6b, jadi kebun ini kembali kosong seluruhnya.
  // Kebun baru yang belum ditanami berada dalam keadaan yang sama persis.

  const farmEmpty = firstRpcRow(
    await createFarmSchedule('owner creates a farm-wide schedule with nothing planted', `Se-kebun kosong ${runId}`)
  );

  const farmEmptyActivityId = await expectSuccess(
    STAGE,
    'worker completes the farm-wide task with nothing planted',
    worker.client.rpc('complete_task', { p_task_id: farmEmpty.task_id, p_note: 'Se-kebun kosong' }),
    'Zero trees is a legitimate state -- completion must not raise.'
  );

  assertCondition(
    STAGE,
    'completion still records an activity when nothing is planted',
    Boolean(farmEmptyActivityId),
    'complete_task returned no activity id.',
    'The work really happened; it just does not attach to any tree.'
  );

  assertEqual(
    STAGE,
    'nothing is linked when no position is planted',
    (await farmActivityTreeIds('empty-farm links are readable', farmEmptyActivityId)).length,
    0,
    'An empty farm must link zero trees -- and must not raise while doing it.'
  );
});
