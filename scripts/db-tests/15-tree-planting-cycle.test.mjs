import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createIsolatedFarmWithWorker,
  expectFailure,
  expectSuccess,
  getSingle,
  isoDateOffset,
  makeRunId,
  runStage,
  todayIso,
} from './test-utils.mjs';

// Menguji siklus tanam yang dibangun migrasi 055:
//   - membuat pohon membuka siklus pertamanya dalam satu transaksi
//   - memulai siklus baru saat masih ada yang aktif DITOLAK
//   - menutup siklus lalu memulai yang baru: cycle_no naik
//   - menutup siklus saat tidak ada yang aktif DITOLAK
//   - alasan berakhir di luar daftar yang sah DITOLAK
//   - tanggal berakhir yang mendahului tanggal tanam DITOLAK
//   - menutup siklus TIDAK mengubah kondisi pohon
//   - authenticated tidak punya jalur tulis langsung ke tree_plantings
//
// Lalu koreksi penanaman yang dibangun migrasi 056:
//   - mengoreksi varietas & tanggal tanam siklus aktif: cycle_no TIDAK naik
//   - mengoreksi posisi yang siklusnya sudah ditutup DITOLAK
//   - authenticated tidak punya jalur tulis langsung ke trees
//
// Stage ini berdiri sendiri seperti stage 09, 10, dan 14: seluruh pelaku dan
// kebunnya dibuat di dalam tes. Itu syarat, bukan gaya -- stage ini menanam dan
// mematikan pohon berkali-kali di satu posisi, dan kalau dijalankan di kebun
// bersama milik stage 01 ia akan mengubah angka yang diperiksa stage 06.

const STAGE = '15 tree planting cycle';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'cycle',
    workerPhone: '081999006001',
  });

  // ---------- 1. Membuat pohon membuka siklus pertamanya ----------

  const treeId = await expectSuccess(
    STAGE,
    'owner creates tree with its first planting',
    owner.client.rpc('create_tree_with_planting', {
      p_farm_id: farm.id,
      p_row_position: 3,
      p_column_position: 'C',
      p_variety: 'Alpukat Mentega',
      p_planted_at: isoDateOffset(-30),
    }),
    'Check create_tree_with_planting(uuid, smallint, text, text, date).'
  );

  const tree = await getSingle(
    STAGE,
    'tree row exists with a generated code',
    owner.client.from('trees').select('id, tree_code, current_condition').eq('id', treeId).single(),
    'create_tree_with_planting should insert into trees.'
  );
  assertEqual(STAGE, 'tree_code follows its position', tree.tree_code, '3-C',
    'tree_code is GENERATED from row_position and column_position (migration 054).');

  const cycleOne = await getSingle(
    STAGE,
    'first cycle opened in the same transaction',
    owner.client
      .from('tree_plantings')
      .select('id, cycle_no, variety, planted_at, ended_at, end_reason, ended_by')
      .eq('tree_id', treeId)
      .single(),
    'A tree without a planting cycle is an invalid state -- both rows must be born together.'
  );
  assertEqual(STAGE, 'first cycle is numbered 1', cycleOne.cycle_no, 1,
    'The first planting on a position must be cycle_no 1.');
  assertEqual(STAGE, 'first cycle is running', cycleOne.ended_at, null,
    'A newly opened cycle must not be closed.');
  assertEqual(STAGE, 'first cycle keeps its variety', cycleOne.variety, 'Alpukat Mentega',
    'variety belongs to the cycle, not to the position.');

  // ---------- 2. Siklus baru DITOLAK selagi ada yang aktif ----------

  await expectFailure(
    STAGE,
    'starting a second cycle while one is running is rejected',
    owner.client.rpc('start_tree_planting', {
      p_tree_id: treeId,
      p_variety: 'Miki',
      p_planted_at: todayIso(),
    }),
    'start_tree_planting must refuse while an active cycle exists -- one position, one living tree.'
  );

  // ---------- 3. Alasan berakhir harus dari daftar yang sah ----------

  await expectFailure(
    STAGE,
    'closing with an unlisted end reason is rejected',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'ditebang',
      p_ended_at: todayIso(),
    }),
    'end_reason is constrained to mati / dibongkar / diganti.'
  );

  // ---------- 4. Tanggal berakhir tidak boleh mendahului tanggal tanam ----------

  await expectFailure(
    STAGE,
    'closing before the planting date is rejected',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'mati',
      p_ended_at: isoDateOffset(-90),
    }),
    'ended_at must not precede planted_at.'
  );

  // ---------- 5. Menutup siklus yang berjalan ----------

  await expectSuccess(
    STAGE,
    'owner closes the running cycle',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'mati',
      p_ended_at: isoDateOffset(-1),
    }),
    'Check end_tree_planting(uuid, text, date).'
  );

  const closedCycle = await getSingle(
    STAGE,
    'closed cycle carries its audit fields',
    owner.client
      .from('tree_plantings')
      .select('id, cycle_no, ended_at, end_reason, ended_by')
      .eq('id', cycleOne.id)
      .single(),
    'end_tree_planting should stamp ended_at, end_reason, and ended_by.'
  );
  assertEqual(STAGE, 'closed cycle keeps its end reason', closedCycle.end_reason, 'mati',
    'end_reason should be stored as given.');
  assertEqual(STAGE, 'closed cycle records who ended it', closedCycle.ended_by, owner.userId,
    'ended_by should be auth.uid() of the caller.');
  assertCondition(STAGE, 'closed cycle has an end date', Boolean(closedCycle.ended_at),
    'ended_at was not set.',
    'The end pair constraint requires ended_at whenever end_reason is present.');

  // ---------- 6. Menutup siklus saat tidak ada yang aktif DITOLAK ----------

  await expectFailure(
    STAGE,
    'closing again with no running cycle is rejected',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'mati',
      p_ended_at: todayIso(),
    }),
    'end_tree_planting must refuse when the position has no running cycle.'
  );

  // ---------- 7. Menanami ulang posisi yang sama: cycle_no naik ----------

  const cycleTwoId = await expectSuccess(
    STAGE,
    'owner replants the same position',
    owner.client.rpc('start_tree_planting', {
      p_tree_id: treeId,
      p_variety: 'Miki',
      p_planted_at: todayIso(),
    }),
    'Check start_tree_planting(uuid, text, date).'
  );

  const cycleTwo = await getSingle(
    STAGE,
    'second cycle is numbered 2',
    owner.client
      .from('tree_plantings')
      .select('id, cycle_no, variety, ended_at')
      .eq('id', cycleTwoId)
      .single(),
    'start_tree_planting should take max(cycle_no) + 1.'
  );
  assertEqual(STAGE, 'replanting increments the cycle number', cycleTwo.cycle_no, 2,
    'A position replanted once must be on cycle_no 2.');
  assertEqual(STAGE, 'second cycle is running', cycleTwo.ended_at, null,
    'A freshly started cycle must be open.');
  assertEqual(STAGE, 'second cycle carries its own variety', cycleTwo.variety, 'Miki',
    'Replanting may use a different variety -- that is the whole point of separating cycles.');

  const allCycles = await expectSuccess(
    STAGE,
    'both cycles are kept side by side',
    owner.client
      .from('tree_plantings')
      .select('cycle_no')
      .eq('tree_id', treeId)
      .order('cycle_no', { ascending: true }),
    'Closing a cycle must never overwrite it -- the old planting stays readable.'
  );
  assertEqual(STAGE, 'position keeps two separate cycles', allCycles.length, 2,
    'The history of two different trees on one position must stay separate.');

  // ---------- 8. Menutup siklus TIDAK menyentuh kondisi pohon ----------
  //
  // Pemisahan ini disengaja dan ditegaskan migrasi 055: kondisi adalah
  // pengamatan lapangan yang bisa dikoreksi, akhir siklus adalah keputusan
  // owner yang tersimpan permanen. Pohon di atas sudah ditutup siklusnya dengan
  // alasan 'mati', dan current_condition-nya HARUS tetap seperti semula.

  const treeAfterClose = await getSingle(
    STAGE,
    'tree condition is untouched by cycle changes',
    owner.client.from('trees').select('id, current_condition').eq('id', treeId).single(),
    'end_tree_planting must not write to trees.current_condition.'
  );
  assertEqual(
    STAGE,
    'condition stays what it was before the cycle closed',
    treeAfterClose.current_condition,
    tree.current_condition,
    'Recording a cycle end must not double as recording a field observation.'
  );

  // ---------- 9. Tidak ada jalur tulis langsung ke tree_plantings ----------

  await expectFailure(
    STAGE,
    'owner cannot insert a planting directly',
    owner.client.from('tree_plantings').insert({
      tree_id: treeId,
      farm_id: farm.id,
      cycle_no: 99,
      created_by: owner.userId,
    }),
    'tree_plantings write grants are revoked -- the RPCs are the only way in.'
  );

  // ---------- 10. Pekerja boleh membaca, tidak boleh menulis ----------

  const workerView = await expectSuccess(
    STAGE,
    'active worker can read plantings in their farm',
    worker.client.from('tree_plantings').select('id, cycle_no').eq('tree_id', treeId),
    'SELECT policy follows trees: every active farm member can read.'
  );
  assertEqual(STAGE, 'worker sees both cycles', workerView.length, 2,
    'Active members should read the full cycle history of their farm.');

  await expectFailure(
    STAGE,
    'worker cannot start a cycle',
    worker.client.rpc('start_tree_planting', {
      p_tree_id: treeId,
      p_variety: 'Miki',
      p_planted_at: todayIso(),
    }),
    'Only active owners may manage planting cycles.'
  );

  // ---------- 11. KOREKSI siklus aktif: cycle_no TIDAK naik (migrasi 056) ----------
  //
  // Perbedaan yang diuji di sini adalah inti migrasi 056. Salah ketik saat input
  // adalah kesalahan PENCATATAN; memperbaikinya harus menyentuh siklus yang
  // sedang berjalan. Kalau ia malah membuka siklus baru, aplikasi mengarang
  // peristiwa penanaman ulang yang tidak pernah terjadi -- dan itu lebih
  // merusak daripada salah ketiknya.
  //
  // Posisi ikut dikoreksi dalam panggilan yang sama: satu RPC, satu transaksi.

  const correctedPlantedAt = isoDateOffset(-10);

  await expectSuccess(
    STAGE,
    'owner corrects the running cycle',
    owner.client.rpc('update_tree_with_planting', {
      p_tree_id: treeId,
      p_row_position: 4,
      p_column_position: 'C',
      p_variety: 'Alpukat Hass',
      p_planted_at: correctedPlantedAt,
    }),
    'Check update_tree_with_planting(uuid, smallint, text, text, date).'
  );

  const correctedTree = await getSingle(
    STAGE,
    'correction moves the position too',
    owner.client.from('trees').select('id, tree_code').eq('id', treeId).single(),
    'update_tree_with_planting should update trees and tree_plantings together.'
  );
  assertEqual(STAGE, 'tree_code follows the corrected position', correctedTree.tree_code, '4-C',
    'tree_code is GENERATED, so correcting row_position must regenerate it.');

  const correctedCycle = await getSingle(
    STAGE,
    'correction rewrites the running cycle in place',
    owner.client
      .from('tree_plantings')
      .select('id, cycle_no, variety, planted_at, ended_at')
      .eq('id', cycleTwoId)
      .single(),
    'A correction must edit the active cycle row, not create another one.'
  );
  assertEqual(STAGE, 'correction does NOT bump the cycle number', correctedCycle.cycle_no, 2,
    'THIS IS THE POINT OF 056: correcting a typo must not fake a replanting.');
  assertEqual(STAGE, 'corrected variety is stored', correctedCycle.variety, 'Alpukat Hass',
    'variety on the active cycle should follow the correction.');
  assertEqual(STAGE, 'corrected planting date is stored', correctedCycle.planted_at, correctedPlantedAt,
    'planted_at on the active cycle should follow the correction.');
  assertEqual(STAGE, 'corrected cycle is still running', correctedCycle.ended_at, null,
    'A correction must never close the cycle it corrects.');

  const cyclesAfterCorrection = await expectSuccess(
    STAGE,
    'correction creates no extra cycle',
    owner.client
      .from('tree_plantings')
      .select('cycle_no')
      .eq('tree_id', treeId)
      .order('cycle_no', { ascending: true }),
    'The position must still hold exactly the two cycles it had before.'
  );
  assertEqual(STAGE, 'position still holds two cycles', cyclesAfterCorrection.length, 2,
    'A third row here means the correction was implemented as a replanting.');

  const untouchedClosedCycle = await getSingle(
    STAGE,
    'the closed cycle is left alone',
    owner.client.from('tree_plantings').select('id, variety').eq('id', cycleOne.id).single(),
    'update_tree_with_planting must only touch the cycle where ended_at is null.'
  );
  assertEqual(
    STAGE,
    'closed cycle keeps its original variety',
    untouchedClosedCycle.variety,
    'Alpukat Mentega',
    'A finished planting is a settled fact -- correcting the running cycle must not rewrite it.'
  );

  // ---------- 12. KOREKSI pada posisi tanpa siklus aktif DITOLAK ----------
  //
  // Mengoreksi "data penanaman" pada posisi yang tidak ditanami apa pun tidak
  // punya makna, dan menyentuh siklus yang sudah ditutup berarti mengubah fakta
  // yang sudah selesai.

  await expectSuccess(
    STAGE,
    'owner closes the corrected cycle',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'dibongkar',
      p_ended_at: todayIso(),
    }),
    'Check end_tree_planting(uuid, text, date).'
  );

  await expectFailure(
    STAGE,
    'correcting a position with no running cycle is rejected',
    owner.client.rpc('update_tree_with_planting', {
      p_tree_id: treeId,
      p_row_position: 5,
      p_column_position: 'C',
      p_variety: 'Miki',
      p_planted_at: todayIso(),
    }),
    'update_tree_with_planting must refuse when the position has no active planting.'
  );

  const treeAfterRejectedCorrection = await getSingle(
    STAGE,
    'rejected correction leaves the position untouched',
    owner.client.from('trees').select('id, tree_code').eq('id', treeId).single(),
    'The active-cycle guard must run BEFORE the update to trees, not after.'
  );
  assertEqual(
    STAGE,
    'position stays where it was before the rejection',
    treeAfterRejectedCorrection.tree_code,
    '4-C',
    'A half-applied correction would move the tree and still report failure.'
  );

  // ---------- 13. Tidak ada jalur tulis langsung ke trees (migrasi 056) ----------
  //
  // Ini yang membuktikan lubang kedua tertutup. Selama grant INSERT masih
  // menempel di authenticated, owner bisa menyisipkan baris trees TELANJANG --
  // dan baris itu berumur tanpa siklus tanam: tidak terlihat sebagai pohon,
  // tidak terlihat sebagai posisi kosong. create_tree_with_planting adalah
  // satu-satunya jalur yang menjamin keduanya lahir bersama.

  await expectFailure(
    STAGE,
    'active owner cannot insert a bare tree row',
    owner.client.from('trees').insert({
      farm_id: farm.id,
      row_position: 7,
      column_position: 'G',
    }),
    'trees INSERT grant is revoked (migration 056) -- create_tree_with_planting is the only way in.'
  );
});
