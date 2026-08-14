import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createIsolatedFarmWithWorker,
  expectSuccess,
  firstRpcRow,
  getSingle,
  makeRunId,
  runStage,
  todayIso,
} from './test-utils.mjs';

// Menguji penautan pohon yang dibangun migrasi 050:
//   - target 'tree'   -> tepat satu pohon tertaut
//   - target 'farm'   -> seluruh pohon kebun yang belum diarsipkan
//   - pohon terarsip TIDAK ikut tertaut
//   - target 'custom' -> tidak ada pohon yang tertaut, dan tugas tetap selesai
//   - aktivitas yang tertaut muncul di tree_history_view
//
// Stage berdiri sendiri: jumlah pohon kebun harus diketahui persis untuk
// menguji cabang 'farm', dan itu mustahil di kebun bersama yang jumlah pohonnya
// ditambah stage lain.

const STAGE = '12 care activity tree links';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'treelink',
    workerPhone: '081999003001',
  });

  // ---------- Persiapan: dua pohon aktif, satu pohon terarsip ----------

  const treeA = await createTree(owner, farm.id, `TL-A-${runId}`, 'A', '1');
  const treeB = await createTree(owner, farm.id, `TL-B-${runId}`, 'A', '2');
  const treeArchived = await createTree(owner, farm.id, `TL-ARC-${runId}`, 'B', '1');

  await expectSuccess(
    STAGE,
    'owner archives the third tree',
    owner.client.from('trees').update({ is_archived: true }).eq('id', treeArchived.id),
    'Active owner should be able to archive trees.'
  );

  const activeTrees = await expectSuccess(
    STAGE,
    'farm has exactly two active trees',
    owner.client.from('trees').select('id').eq('farm_id', farm.id).eq('is_archived', false),
    'Active owner should read trees of their farm.'
  );
  assertEqual(STAGE, 'active tree count is two', activeTrees.length, 2,
    'Precondition failed: the farm-target assertion below depends on this count.');

  // ---------- 1. Target pohon menautkan tepat satu pohon ----------

  const treeTargetTaskId = await createAndCompleteTask({
    owner,
    worker,
    farmId: farm.id,
    title: `Tree Target ${runId}`,
    targetType: 'tree',
    targetTreeId: treeA.id,
    customNote: null,
    operation: 'tree-targeted task',
  });

  const treeTargetLinks = await readLinks(owner, treeTargetTaskId, 'tree-targeted');
  assertEqual(STAGE, 'tree target links exactly one tree', treeTargetLinks.length, 1,
    'complete_task should link exactly one row for target_type = tree.');
  assertEqual(STAGE, 'tree target links the right tree', treeTargetLinks[0].tree_id, treeA.id,
    'The linked tree must be care_tasks.target_tree_id.');

  // ---------- 2. Target kebun menautkan semua pohon aktif ----------

  const farmTargetTaskId = await createAndCompleteTask({
    owner,
    worker,
    farmId: farm.id,
    title: `Farm Target ${runId}`,
    targetType: 'farm',
    targetTreeId: null,
    customNote: null,
    operation: 'farm-targeted task',
  });

  const farmTargetLinks = await readLinks(owner, farmTargetTaskId, 'farm-targeted');
  const farmLinkedIds = farmTargetLinks.map((row) => row.tree_id).sort();
  assertEqual(STAGE, 'farm target links every active tree', farmTargetLinks.length, 2,
    'complete_task should link all non-archived trees for target_type = farm.');
  assertCondition(
    STAGE,
    'farm target links both active trees',
    farmLinkedIds.includes(treeA.id) && farmLinkedIds.includes(treeB.id),
    'Farm-targeted completion did not link both active trees.',
    'Check the farm branch of complete_task.'
  );
  assertCondition(
    STAGE,
    'farm target excludes the archived tree',
    !farmLinkedIds.includes(treeArchived.id),
    'An archived tree was linked to a farm-targeted activity.',
    'The farm branch of complete_task filters is_archived = false. Archiving means the tree is no longer part of the farm being cared for.'
  );

  // ---------- 3. Target catatan bebas tidak menautkan apa pun ----------

  const customTargetTaskId = await createAndCompleteTask({
    owner,
    worker,
    farmId: farm.id,
    title: `Custom Target ${runId}`,
    targetType: 'custom',
    targetTreeId: null,
    customNote: 'Saluran air dekat gudang',
    operation: 'custom-targeted task',
  });

  const customTargetLinks = await readLinks(owner, customTargetTaskId, 'custom-targeted');
  assertEqual(STAGE, 'custom target links no tree at all', customTargetLinks.length, 0,
    'A free-text target points at no tree, so nothing can be linked.');

  const customTask = await getSingle(
    STAGE,
    'custom-targeted task still completes',
    owner.client.from('care_tasks').select('id, status').eq('id', customTargetTaskId).single(),
    'Linking nothing must not block completion.'
  );
  assertEqual(STAGE, 'custom-targeted task reaches completed', customTask.status, 'completed',
    'The task itself is still real work and must be recorded.');

  // ---------- 4. Riwayat pohon memuat pekerjaan terjadwal ----------
  //
  // Sebelum migrasi 050 jembatan hanya terisi dari jalur inisiatif, sehingga
  // baris 'care' dengan asal 'terjadwal' MUSTAHIL muncul di sini.
  const historyA = await expectSuccess(
    STAGE,
    'tree history includes scheduled care for tree A',
    owner.client
      .from('tree_history_view')
      .select('tree_id, history_type, asal')
      .eq('tree_id', treeA.id),
    'tree_history_view reads care rows through care_activity_trees.'
  );
  assertCondition(
    STAGE,
    'scheduled care appears in tree history',
    historyA.some((row) => row.history_type === 'care' && row.asal === 'terjadwal'),
    'Tree history has no scheduled care row.',
    'Check the care union of tree_history_view and the care_activity_trees join.'
  );

  const historyArchived = await expectSuccess(
    STAGE,
    'archived tree history has no care row from the farm-target task',
    owner.client
      .from('tree_history_view')
      .select('tree_id, history_type')
      .eq('tree_id', treeArchived.id),
    'tree_history_view reads care rows through care_activity_trees.'
  );
  assertEqual(
    STAGE,
    'archived tree collected no care history',
    historyArchived.filter((row) => row.history_type === 'care').length,
    0,
    'An archived tree must not collect care history from farm-targeted work.'
  );
});

async function createTree(owner, farmId, treeCode, rowPosition, columnPosition) {
  return getSingle(
    STAGE,
    `owner creates tree ${treeCode}`,
    owner.client
      .from('trees')
      .insert({
        farm_id: farmId,
        tree_code: treeCode,
        row_position: rowPosition,
        column_position: columnPosition,
        variety: 'Alpukat Test',
        planted_at: todayIso(),
      })
      .select('id, tree_code, is_archived')
      .single(),
    'Active owner should be able to insert trees.'
  );
}

async function createAndCompleteTask({
  owner,
  worker,
  farmId,
  title,
  targetType,
  targetTreeId,
  customNote,
  operation,
}) {
  const scheduleRows = await expectSuccess(
    STAGE,
    `owner creates ${operation}`,
    owner.client.rpc('create_manual_schedule', {
      p_farm_id: farmId,
      p_title: title,
      p_category: 'fertilizing',
      p_scheduled_date: todayIso(),
      p_assigned_worker_id: worker.userId,
      p_target_type: targetType,
      p_target_tree_id: targetTreeId,
      p_custom_target_note: customNote,
      p_instruction: `Instruction for ${operation}`,
      p_requires_photo: false,
      p_repeat_every_days: null,
      p_grace_days: null,
      p_never_expires: true,
      p_date_basis: 'jadwal',
    }),
    'Check create_manual_schedule signature after migration 048.'
  );
  const schedule = firstRpcRow(scheduleRows);

  await expectSuccess(
    STAGE,
    `worker completes ${operation}`,
    worker.client.rpc('complete_task', {
      p_task_id: schedule.task_id,
      p_note: `Completed ${operation}`,
    }),
    'Check complete_task(p_task_id, p_note, p_produk, p_produk_jumlah, p_produk_satuan).'
  );

  return schedule.task_id;
}

// Jembatan tidak menyimpan care_task_id, jadi pembacaannya lewat aktivitas
// milik tugas tersebut.
async function readLinks(owner, taskId, label) {
  const activities = await expectSuccess(
    STAGE,
    `read completed activity of ${label} task`,
    owner.client
      .from('care_activities')
      .select('id, status')
      .eq('care_task_id', taskId)
      .eq('status', 'completed'),
    'Active owner should read care_activities of their farm.'
  );
  assertEqual(STAGE, `${label} task has exactly one completed activity`, activities.length, 1,
    'complete_task refuses to record a completed task twice.');

  return expectSuccess(
    STAGE,
    `read tree links of ${label} activity`,
    owner.client
      .from('care_activity_trees')
      .select('care_activity_id, tree_id')
      .eq('care_activity_id', activities[0].id),
    'care_activity_trees SELECT policy should let an active owner read links of their farm activities.'
  );
}
