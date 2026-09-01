import { assertEnv } from './config.mjs';
import {
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
    // Dari stage 04. Dipakai cakupan hapus di bawah untuk menemukan satu
    // aktivitas perawatan TERJADWAL tanpa membuat jadwal baru di sini.
    'treeTaskId',
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
      p_fruit_condition: 'A2',
      p_fruit_count: 5,
      p_harvested_at: null,
      p_note: 'Updated harvest foundation test',
      p_record_id: harvest.id,
    }),
    'update_own_harvest_record should update author-owned active records.'
  );

  // Pembuatan manual_care_record dan RPC update_own_manual_care_record dibuang:
  // tabel manual_care_records di-drop migrasi 031. Padanan hidupnya adalah
  // care_activities, yang jalur edit/hapusnya diuji stage 12 dan 14.

  const historyBeforeDelete = await expectSuccess(
    STAGE,
    'tree_history_view exposes source_id',
    ownerClient
      .from('tree_history_view')
      .select('source_id, history_type')
      .eq('tree_id', state.treeId)
      .in('source_id', [condition.id, phase.id, harvest.id]),
    'tree_history_view should expose source_id for tree record detail routing.'
  );
  // Tiga, bukan empat: manualCare.id dibuang bersama bloknya di atas, dan angka
  // 4 memang sudah tidak pernah tercapai sejak migrasi 028 mencabut union
  // 'manual_care' dari tree_history_view.
  //
  // Namanya tetap "before delete" dan kini benar lagi: migrasi 067 membawa
  // kembali soft delete, dan seluruh penghapusan berada SESUDAH asersi ini.
  // Urutan itu disengaja -- angka 3 di bawah menghitung baris di
  // tree_history_view, dan menghapus lebih dulu akan mengubahnya menjadi angka
  // yang mengukur hal lain.
  assertEqual(
    STAGE,
    'history contains three source rows',
    historyBeforeDelete.length,
    3,
    'Condition, phase, and harvest records should appear in tree_history_view.'
  );

  // ==========================================================================
  // HAPUS CATATAN (migrasi 067)
  //
  // Semua di bawah ini berjalan SESUDAH asersi tiga baris di atas, jadi tidak
  // ada angka yang perlu disesuaikan.
  //
  // Peran yang dipakai, dan kenapa cukup dua akun yang sudah ada:
  //   pekerja  = pencatat condition + phase
  //   pemilik  = pencatat harvest
  // Sehingga "orang ketiga" bisa diuji tanpa mendaftarkan akun ketiga: pekerja
  // mencoba menghapus catatan panen MILIK PEMILIK -- ia bukan pencatatnya dan
  // bukan pemilik kebun. Menambah akun ketiga akan membayar satu pendaftaran
  // lagi ke jendela rate limit Auth demi hal yang sudah bisa dibuktikan.
  // ==========================================================================

  await expectFailure(
    STAGE,
    'third party cannot delete a record they did not write',
    workerClient.rpc('soft_delete_harvest_record', {
      p_reason: null,
      p_record_id: harvest.id,
    }),
    'ensure_can_delete_farm_record (067) should reject a member who is neither the author nor the farm owner.'
  );

  // Perawatan TERJADWAL tidak bisa dihapus siapa pun, termasuk pemilik kebun.
  // Aktivitasnya diambil dari tugas yang dibuat stage 04 -- tidak perlu membuat
  // jadwal baru di sini.
  const scheduledActivity = await getSingle(
    STAGE,
    'scheduled care activity is readable',
    ownerClient
      .from('care_activities')
      .select('id, asal')
      .eq('care_task_id', state.treeTaskId)
      .eq('asal', 'terjadwal')
      .limit(1)
      .single(),
    'Stage 04 should have left at least one scheduled care activity on the tree task.'
  );

  await expectFailure(
    STAGE,
    'scheduled care activity cannot be soft deleted',
    ownerClient.rpc('soft_delete_care_activity', {
      p_activity_id: scheduledActivity.id,
      p_reason: null,
    }),
    'soft_delete_care_activity (067) must reject asal=terjadwal; cancelling goes through rollback_completed_task_activity.',
  );

  // Perawatan INISIATIF milik PEKERJA, dihapus PEMILIK. Ini jalur
  // "pemilik menghapus catatan orang lain" yang membedakan izin hapus dari izin
  // ubah -- pemilik tidak akan pernah bisa mengedit catatan yang sama.
  const initiativeActivityId = await expectSuccess(
    STAGE,
    'worker records an initiative care activity',
    workerClient.rpc('create_care_activity', {
      p_farm_id: state.farmId,
      p_category: 'watering',
      p_tree_ids: [state.treeId],
      p_note: 'Initiative care for soft delete test',
      p_produk: null,
      p_performed_at: null,
    }),
    'Check create_care_activity(uuid, care_category, uuid[], text, text, timestamptz) from migration 027.'
  );

  await expectSuccess(
    STAGE,
    'farm owner deletes an initiative care activity written by the worker',
    ownerClient.rpc('soft_delete_care_activity', {
      p_activity_id: initiativeActivityId,
      p_reason: null,
    }),
    'Farm owners may delete any record in their farm (067), even records they cannot edit.'
  );

  const historyAfterCareDelete = await expectSuccess(
    STAGE,
    'deleted care activity disappears from tree_history_view',
    ownerClient
      .from('tree_history_view')
      .select('source_id')
      .eq('tree_id', state.treeId)
      .eq('source_id', initiativeActivityId),
    'The care branch of tree_history_view must filter is_deleted = false (067).'
  );
  assertEqual(
    STAGE,
    'deleted care activity is not in history',
    historyAfterCareDelete.length,
    0,
    'Soft deleted care activities should not appear in tree_history_view.'
  );

  // ---- Kolom turunan mundur ke catatan sebelumnya --------------------------
  //
  // Fase baru dengan nilai yang BERBEDA dari fase terakhir yang ada
  // ('harvesting' lawan 'fruiting'), supaya kemunduran benar-benar terlihat.
  // Kalau nilainya sama, asersi setelah penghapusan tidak membuktikan apa pun.
  const laterRecordedAt = '2099-01-03T00:00:00.000Z';

  const phaseToDelete = await getSingle(
    STAGE,
    'worker records a newer growth phase',
    workerClient
      .from('growth_phase_records')
      .insert({
        farm_id: state.farmId,
        note: 'Newest phase, will be deleted',
        phase: 'harvesting',
        recorded_at: laterRecordedAt,
        recorded_by: state.workerId,
        tree_id: state.treeId,
      })
      .select('id')
      .single(),
    'Active workers should still be able to create growth phase records.'
  );

  const treeBeforePhaseDelete = await getSingle(
    STAGE,
    'newest phase drives tree phase and its start date',
    ownerClient
      .from('trees')
      .select('id, current_growth_phase, current_growth_phase_since')
      .eq('id', state.treeId)
      .single(),
    'sync_tree_current_growth_phase should follow the newest phase record.'
  );
  assertEqual(STAGE, 'tree phase is harvesting before delete',
    treeBeforePhaseDelete.current_growth_phase, 'harvesting',
    'The 2099-01-03 record should be the newest.');
  // current_growth_phase_since bertipe date dan diturunkan sebagai tanggal WIB
  // dari recorded_at (migrasi 066). 2099-01-03T00:00Z = 2099-01-03 07:00 WIB,
  // jadi tanggalnya tidak bergeser.
  assertEqual(STAGE, 'phase since matches the newest record date',
    treeBeforePhaseDelete.current_growth_phase_since, '2099-01-03',
    'recalculate_tree_current_growth_phase should write the WIB date of the same row.');

  await expectSuccess(
    STAGE,
    'author deletes their own growth phase record',
    workerClient.rpc('soft_delete_growth_phase_record', {
      p_reason: null,
      p_record_id: phaseToDelete.id,
    }),
    'Record authors may delete their own records (067).'
  );

  const treeAfterPhaseDelete = await getSingle(
    STAGE,
    'tree phase falls back to the previous record',
    ownerClient
      .from('trees')
      .select('id, current_growth_phase, current_growth_phase_since')
      .eq('id', state.treeId)
      .single(),
    'soft_delete_growth_phase_record should call recalculate_tree_current_growth_phase.'
  );
  assertEqual(STAGE, 'tree phase rolled back to fruiting',
    treeAfterPhaseDelete.current_growth_phase, 'fruiting',
    'Deleting the newest phase should expose the one before it.');
  assertEqual(STAGE, 'phase since rolled back too',
    treeAfterPhaseDelete.current_growth_phase_since, '2099-01-02',
    'current_growth_phase_since must move with current_growth_phase; both come from one row.');

  await expectFailure(
    STAGE,
    'deleting the same record twice is rejected',
    workerClient.rpc('soft_delete_growth_phase_record', {
      p_reason: null,
      p_record_id: phaseToDelete.id,
    }),
    'soft_delete_growth_phase_record should reject records that are already deleted.'
  );

  // Kondisi: catatan stage ini bernilai 'damaged' dan bertanggal 2099, jadi ia
  // yang sedang berlaku. Di bawahnya masih ada catatan 'needs_attention' dari
  // stage 03 -- itulah yang harus muncul kembali.
  await expectSuccess(
    STAGE,
    'author deletes their own condition report',
    workerClient.rpc('soft_delete_tree_condition_report', {
      p_reason: null,
      p_report_id: condition.id,
    }),
    'Record authors may delete their own records (067).'
  );

  const treeAfterConditionDelete = await getSingle(
    STAGE,
    'tree condition falls back to the previous report',
    ownerClient.from('trees').select('id, current_condition').eq('id', state.treeId).single(),
    'soft_delete_tree_condition_report should call recalculate_tree_current_condition.'
  );
  assertEqual(STAGE, 'tree condition rolled back to needs_attention',
    treeAfterConditionDelete.current_condition, 'needs_attention',
    'Deleting the newest condition report should expose the stage 03 report beneath it.');

  await expectSuccess(
    STAGE,
    'author deletes their own harvest record',
    ownerClient.rpc('soft_delete_harvest_record', {
      p_reason: null,
      p_record_id: harvest.id,
    }),
    'Record authors may delete their own records (067). Harvest has no derived tree column to recalculate.'
  );

  const historyAfterDeletes = await expectSuccess(
    STAGE,
    'all deleted records disappear from tree_history_view',
    ownerClient
      .from('tree_history_view')
      .select('source_id')
      .eq('tree_id', state.treeId)
      .in('source_id', [condition.id, phaseToDelete.id, harvest.id]),
    'All four branches of tree_history_view must filter is_deleted = false.'
  );
  assertEqual(
    STAGE,
    'history no longer contains the deleted rows',
    historyAfterDeletes.length,
    0,
    'Condition, phase, and harvest branches should all hide soft deleted rows.'
  );
});
