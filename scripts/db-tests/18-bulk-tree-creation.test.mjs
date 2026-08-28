import { assertEnv } from './config.mjs';
import {
  assertCondition,
  assertEqual,
  createAnonClient,
  createIsolatedFarmWithWorker,
  expectFailure,
  expectSuccess,
  fail,
  firstRpcRow,
  getSingle,
  makeRunId,
  runStage,
  signUpActor,
  todayIso,
} from './test-utils.mjs';

// Menguji create_trees_at_positions, pembuatan pohon massal dari migrasi 062:
//   - N posisi lahir dalam SATU transaksi, masing-masing berikut siklus
//     pertamanya -- pohon tanpa siklus adalah keadaan yang tidak sah
//   - posisi terisi, di luar petak, dan cacat bentuk DISARING lalu DILAPORKAN,
//     sisanya tetap dibuat
//   - posisi BERARSIP tetap terhitung menempati kodenya
//   - duplikat dalam satu himpunan tidak memecahkan transaksi
//   - nol posisi sah mengembalikan laporan kosong, BUKAN exception
//   - created_codes terurut menurut posisi, bukan menurut teks
//   - pekerja, bukan-anggota, dan anon semuanya ditolak
//
// KENAPA STAGE INI ADA WALAU 062 SUDAH DIVERIFIKASI MANUAL. Verifikasi manual
// lewat SQL Editor memakai set_config untuk mensimulasikan JWT: ia tidak
// melewati PostgREST maupun RLS sungguhan, jadi ketiga asersi hak akses di
// bagian 8 belum pernah benar-benar terbukti. Bagian itulah yang paling
// bernilai di sini; sisanya menjaga perilaku yang sudah terlihat benar supaya
// tetap begitu.
//
// YANG SENGAJA TIDAK DIULANG DI SINI: perilaku create_tree_with_planting,
// start_tree_planting, end_tree_planting, dan update_tree_with_planting.
// Keempatnya sudah ditanggung stage 15 secara menyeluruh, dan migrasi 062 tidak
// menyentuh satu pun dari mereka. Menyalinnya ke sini hanya memperlambat suite
// tanpa menambah jaminan.
//
// Stage ini berdiri sendiri seperti stage 09, 10, 14, 15, dan 16: seluruh
// pelaku dan kebunnya dibuat di dalam tes. Itu syarat, bukan gaya -- stage ini
// membuat belasan pohon dan mengarsipkan salah satunya, dan kalau dijalankan di
// kebun bersama milik stage 01 ia akan mengubah angka yang diperiksa stage 06.

const STAGE = '18 bulk tree creation';

// Batas atas p_position_codes di migrasi 062: 999 x 26, ukuran petak terbesar
// yang mungkin menurut farms_grid_rows_check dan farms_grid_columns_check.
const POSITION_LIMIT = 25974;

// Pesan yang HARUS sama dengan create_tree_with_planting. Lihat bagian 8.
const OWNER_ONLY_MESSAGE = 'Hanya pemilik aktif yang dapat menambah pohon.';

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'bulktree',
    workerPhone: '081999018001',
  });

  // Pengguna terdaftar TANPA kebun. Ia berbeda dari pekerja dan keduanya
  // dibutuhkan: pekerja punya baris farm_members di kebun ini dengan
  // role='worker', sedangkan orang ini tidak punya baris sama sekali. Kalau
  // is_active_owner kelak kehilangan saringan role-nya, pekerja yang
  // menangkapnya; kalau ia kehilangan pencocokan farm_id, orang inilah yang
  // menangkapnya. Satu pelaku saja tidak bisa menutup keduanya.
  const outsider = await signUpActor({
    runId,
    label: 'avology-bulktree-outsider',
    fullName: `Outsider bulktree ${runId}`,
    phone: '081999018002',
  });

  const anonClient = createAnonClient();

  // ---------- Prasyarat petak ----------
  //
  // Ukuran petak DIBACA, tidak ditebak. Tiga asersi di bawah menurunkan
  // posisinya dari angka ini -- posisi di luar petak, dan urutan menaik yang
  // menuntut baris dua digit. Kalau default 26x9 (migrasi 054) berubah, stage
  // ini harus berhenti dengan pesan yang menunjuk petaknya, bukan gagal jauh di
  // bawah dengan galat yang bicara soal hal lain.

  const grid = await getSingle(
    STAGE,
    'test farm exposes its grid size',
    owner.client.from('farms').select('grid_rows, grid_columns').eq('id', farm.id).single(),
    'Active members should be able to read grid_rows/grid_columns (migration 054).'
  );

  // Batas atasnya BUKAN kehati-hatian berlebihan. Kalau grid_rows = 999, posisi
  // "di luar petak" yang diturunkan di bawah menjadi '1000-A' -- empat digit,
  // yang ditolak regex bentuk dan mendarat di rejected_malformed, bukan di
  // rejected_out_of_grid. Asersi bagian 5 akan merah karena alasan yang sama
  // sekali berbeda dari yang sedang diujinya. Hal yang sama berlaku untuk
  // grid_columns = 26, yang membuat huruf berikutnya '[' dan bukan huruf.
  assertCondition(
    STAGE,
    'grid is small enough to derive an out-of-grid position',
    grid.grid_rows >= 12 && grid.grid_rows < 999 && grid.grid_columns >= 4 && grid.grid_columns < 26,
    `Grid is ${grid.grid_rows}x${grid.grid_columns}, outside the range this stage can derive positions from.`,
    'This stage needs 12 <= grid_rows < 999 and 4 <= grid_columns < 26. A fresh farm defaults to 26x9 (migration 054).'
  );

  const outOfGridByRow = `${grid.grid_rows + 1}-A`;
  const outOfGridByColumn = `1-${String.fromCharCode(65 + grid.grid_columns)}`;

  // ---------- Pembantu setempat ----------

  // Pembacaan jumlah baris. SENGAJA tidak mencetak baris lolos: ini bahan
  // penyiapan asersi, bukan asersinya. Polanya mengikuti findFreeTreePosition.
  async function countRows(operation, promise, cause) {
    const result = await promise;

    if (result.error) {
      fail(STAGE, operation, result.error.message, cause);
    }

    return result.count;
  }

  async function readCounts(operation) {
    const trees = await countRows(
      `${operation}: count trees`,
      owner.client.from('trees').select('id', { count: 'exact', head: true }).eq('farm_id', farm.id),
      'Active members should be able to read trees in their own farm.'
    );
    const plantings = await countRows(
      `${operation}: count plantings`,
      owner.client
        .from('tree_plantings')
        .select('id', { count: 'exact', head: true })
        .eq('farm_id', farm.id),
      'Active members should be able to read tree_plantings in their own farm (migration 055).'
    );

    return { plantings, trees };
  }

  async function bulkCreate(operation, { client = owner.client, codes, variety = null, plantedAt = null }) {
    return firstRpcRow(
      await expectSuccess(
        STAGE,
        operation,
        client.rpc('create_trees_at_positions', {
          p_farm_id: farm.id,
          p_planted_at: plantedAt,
          p_position_codes: codes,
          p_variety: variety,
        }),
        'Check create_trees_at_positions(uuid, text[], text, date) from migration 062.'
      )
    );
  }

  // Perbandingan BERURUTAN. Dipakai untuk created_codes, rejected_occupied, dan
  // rejected_out_of_grid -- ketiganya diurutkan migrasi 062 menurut
  // (row_position, column_position), yaitu smallint lalu satu huruf kapital.
  // Urutan itu sama di collation mana pun, jadi menegaskannya aman.
  function assertCodesInOrder(operation, actual, expected, cause) {
    assertEqual(STAGE, operation, JSON.stringify(actual ?? []), JSON.stringify(expected), cause);
  }

  // Perbandingan sebagai HIMPUNAN, urutan diabaikan.
  //
  // Dipakai untuk rejected_malformed dan duplicate_codes, yang diurutkan
  // migrasi 062 dengan `order by code` -- perbandingan teks, dan karenanya
  // bergantung pada collation database. Collation basis data ini tidak bisa
  // diperiksa dari repo, dan pada collation seperti en_US.UTF-8 tanda hubung
  // diperlakukan berbeda dari pada collation C. Menegaskan urutan di sana
  // berarti menguji collation, bukan menguji migrasi 062.
  function assertCodeSet(operation, actual, expected, cause) {
    const sortedActual = [...(actual ?? [])].sort();
    const sortedExpected = [...expected].sort();

    assertEqual(STAGE, operation, JSON.stringify(sortedActual), JSON.stringify(sortedExpected), cause);
  }

  function assertEmptyBuckets(operation, report, cause) {
    const total =
      (report.rejected_occupied ?? []).length +
      (report.rejected_out_of_grid ?? []).length +
      (report.rejected_malformed ?? []).length;

    assertEqual(STAGE, operation, total, 0, cause);
  }

  // ---------- 1. Himpunan lahir utuh: pohon DAN siklusnya ----------
  //
  // Ini inti migrasi 062. Pohon tanpa baris tree_plantings tidak terlihat
  // sebagai pohon dan tidak terlihat sebagai posisi kosong, dan ia TIDAK BISA
  // dikoreksi: prevent_tree_delete_trigger menolak setiap DELETE ke trees, dan
  // mengarsipkannya tidak membebaskan kodenya karena
  // trees_unique_code_per_farm bukan constraint partial.
  //
  // Urutan kode yang dikirim SENGAJA tidak menaik, dan '10-A' sengaja ada:
  // menurut urutan teks '10-A' mendahului '2-A', menurut urutan posisi ia
  // paling akhir. Satu panggilan ini karenanya menguji keutuhan sekaligus
  // pengurutan.

  const before = await readCounts('before first bulk create');

  const firstBatch = await bulkCreate('owner creates three positions in one call', {
    codes: ['10-A', '2-A', '3-B'],
    plantedAt: todayIso(),
    variety: 'Alpukat Mentega',
  });

  assertCodesInOrder(
    'created_codes is ordered by position, not by text',
    firstBatch.created_codes,
    ['2-A', '3-B', '10-A'],
    "Ordering is by (row_position, column_position). Text ordering would put '10-A' first -- that is the bug this checks for."
  );
  assertEqual(
    STAGE,
    'every requested position was created',
    (firstBatch.created_tree_ids ?? []).length,
    3,
    'All three positions were free and inside the grid, so none should have been rejected.'
  );
  assertEmptyBuckets(
    'a fully valid set rejects nothing',
    firstBatch,
    'None of these positions is occupied, out of grid, or malformed.'
  );
  assertEqual(STAGE, 'a fully valid set reports no blanks', firstBatch.blank_count, 0,
    'No null or whitespace-only entries were sent.');
  assertCodeSet('a fully valid set reports no duplicates', firstBatch.duplicate_codes, [],
    'Each code was sent exactly once.');

  // created_codes harus sama persis dengan tree_code yang BENAR-BENAR
  // tersimpan. tree_code adalah kolom GENERATED (migrasi 054), jadi ini yang
  // membuktikan laporan tidak merakit ulang kodenya sendiri dari masukan.
  const createdTrees = await expectSuccess(
    STAGE,
    'created trees are readable by their returned ids',
    owner.client
      .from('trees')
      .select('id, tree_code, row_position, column_position')
      .in('id', firstBatch.created_tree_ids)
      .order('row_position', { ascending: true })
      .order('column_position', { ascending: true }),
    'create_trees_at_positions should return ids of rows that really exist.'
  );
  assertCodesInOrder(
    'created_codes matches the stored tree_code exactly',
    createdTrees.map((row) => row.tree_code),
    firstBatch.created_codes,
    'created_codes comes from the GENERATED tree_code in RETURNING, so it must equal what is stored.'
  );

  const firstPlantings = await expectSuccess(
    STAGE,
    'every created tree opened its first cycle',
    owner.client
      .from('tree_plantings')
      .select('tree_id, cycle_no, variety, planted_at, ended_at')
      .in('tree_id', firstBatch.created_tree_ids),
    'The data-modifying CTE must insert into tree_plantings for every row it inserted into trees.'
  );
  assertEqual(STAGE, 'exactly one cycle per created tree', firstPlantings.length, 3,
    'A tree without a planting cycle is an invalid state that cannot be corrected afterwards.');
  assertCondition(
    STAGE,
    'every first cycle is numbered 1 and still running',
    firstPlantings.every((row) => row.cycle_no === 1 && row.ended_at === null),
    `Got ${JSON.stringify(firstPlantings.map((row) => ({ c: row.cycle_no, e: row.ended_at })))}`,
    'Bulk creation only ever opens cycle 1 -- replanting is start_tree_planting, a different operation.'
  );
  assertCondition(
    STAGE,
    'the whole set shares one variety and one planting date',
    firstPlantings.every((row) => row.variety === 'Alpukat Mentega' && row.planted_at === todayIso()),
    `Got ${JSON.stringify(firstPlantings.map((row) => ({ p: row.planted_at, v: row.variety })))}`,
    'p_variety and p_planted_at apply to the entire set.'
  );

  const afterFirst = await readCounts('after first bulk create');
  assertEqual(STAGE, 'trees grew by exactly the reported count', afterFirst.trees - before.trees, 3,
    'The number of new tree rows must equal array_length(created_tree_ids, 1).');
  assertEqual(
    STAGE,
    'plantings grew by the same amount as trees',
    afterFirst.plantings - before.plantings,
    afterFirst.trees - before.trees,
    'Both tables are written in one statement -- they can never grow by different amounts.'
  );

  // ---------- 2. Varietas kosong tersimpan NULL ----------
  //
  // Dua jalan menuju keadaan yang sama: parameter tidak dikirim sama sekali,
  // dan parameter berisi spasi. nullif(btrim(...), '') harus menyamakan
  // keduanya, sepadan dengan create_tree_with_planting dan start_tree_planting.

  const nullVariety = await bulkCreate('owner creates a position without a variety', {
    codes: ['5-A'],
  });
  const blankVariety = await bulkCreate('owner creates a position with a whitespace variety', {
    codes: ['5-B'],
    variety: '   ',
  });

  const blankVarietyPlantings = await expectSuccess(
    STAGE,
    'both blank-variety cycles are readable',
    owner.client
      .from('tree_plantings')
      .select('tree_id, variety, planted_at')
      .in('tree_id', [...nullVariety.created_tree_ids, ...blankVariety.created_tree_ids]),
    'Both calls should have created one tree each.'
  );
  assertEqual(STAGE, 'both blank-variety positions were created', blankVarietyPlantings.length, 2,
    'One planting row per created tree.');
  assertCondition(
    STAGE,
    'omitted and whitespace-only varieties both store NULL',
    blankVarietyPlantings.every((row) => row.variety === null),
    `Got ${JSON.stringify(blankVarietyPlantings.map((row) => row.variety))}`,
    "nullif(btrim(p_variety), '') must store NULL, never '' and never '   '."
  );
  assertCondition(
    STAGE,
    'an omitted planting date stores NULL',
    blankVarietyPlantings.every((row) => row.planted_at === null),
    `Got ${JSON.stringify(blankVarietyPlantings.map((row) => row.planted_at))}`,
    'p_planted_at defaults to null and tree_plantings.planted_at is nullable.'
  );

  // ---------- 3. Posisi terisi disaring, sisanya TETAP dibuat ----------
  //
  // Ini yang membedakan fungsi ini dari create_tree_with_planting, yang melempar
  // pada bentrokan. Himpunan ratusan posisi yang gugur seluruhnya gara-gara satu
  // posisi terisi tidak berguna bagi pemakainya.

  const occupiedMix = await bulkCreate('an occupied position does not sink the rest of the set', {
    codes: ['2-A', '6-A'],
  });
  assertCodesInOrder('the occupied position is reported', occupiedMix.rejected_occupied, ['2-A'],
    "'2-A' was created in section 1, so it is taken.");
  assertCodesInOrder('the free position in the same call is still created', occupiedMix.created_codes, ['6-A'],
    'Rejecting one position must never cancel the others.');

  // ---------- 4. Posisi BERARSIP tetap menempati kodenya ----------
  //
  // Asersi yang paling mudah salah di seluruh stage ini.
  // trees_unique_code_per_farm TIDAK partial (migrasi 054), jadi baris berarsip
  // masih memegang tree_code-nya. Penyaring keterisian yang ikut menyaring
  // is_archived akan menganggap posisi ini bebas, lalu INSERT-nya menabrak
  // constraint dan MEMECAHKAN SELURUH TRANSAKSI -- termasuk posisi lain yang
  // seharusnya jadi.

  const archivedTreeId = occupiedMix.created_tree_ids[0];

  await expectSuccess(
    STAGE,
    'owner archives one of the created positions',
    owner.client.from('trees').update({ is_archived: true }).eq('id', archivedTreeId).select('id'),
    'Active owners may update their own trees (policy kept by migration 056).'
  );

  const archivedRetry = await bulkCreate('an archived position is still reported as occupied', {
    codes: ['6-A', '7-A'],
  });
  assertCodesInOrder('the archived position lands in rejected_occupied', archivedRetry.rejected_occupied, ['6-A'],
    'Archiving never frees a tree_code -- the unique constraint is not partial.');
  assertCodesInOrder('the free position beside it is still created', archivedRetry.created_codes, ['7-A'],
    'The whole call must survive an archived collision.');

  // ---------- 5. Di luar petak: disaring, trigger tidak melempar ----------
  //
  // validate_tree_position_trigger BERBUNYI untuk setiap baris yang disisipkan;
  // yang dijamin penyaringan adalah ia tidak pernah MELEMPAR. Kalau panggilan
  // ini gagal dengan 'Baris ... di luar ukuran kebun' atau 'Kolom ... di luar
  // ukuran kebun', penyaringnya bocor dan trigger yang menangkapnya.
  //
  // Panggilan ini juga tidak punya satu pun posisi sah, jadi ia sekaligus
  // membuktikan bahwa nol-sah mengembalikan LAPORAN, bukan exception -- pagar
  // terhadap seseorang kelak menyeragamkannya dengan create_manual_schedule
  // (057), yang pada keadaan setara memang melempar dan memang benar begitu.

  const outOfGrid = await bulkCreate('positions outside the grid are filtered, not thrown', {
    codes: [outOfGridByRow, outOfGridByColumn],
  });
  assertCodesInOrder(
    'both out-of-grid positions are reported',
    outOfGrid.rejected_out_of_grid,
    [outOfGridByColumn, outOfGridByRow],
    'Ordering is by (row_position, column_position), so the row-1 entry comes first.'
  );
  assertCodesInOrder('nothing is created when every position is out of grid', outOfGrid.created_codes, [],
    'A set with no valid position must write nothing.');
  assertEqual(STAGE, 'an all-rejected call returns an empty id array', (outOfGrid.created_tree_ids ?? []).length, 0,
    'created_tree_ids must be an empty array, not null.');

  // ---------- 6. Bentuk kode yang cacat ----------
  //
  // Lima cara berbeda melanggar '^[1-9][0-9]{0,2}-[A-Z]$':
  //   '0-A'    baris nol
  //   '012-C'  nol di depan -- akan lahir sebagai '12-C', kode yang BERBEDA
  //            dari yang dikirim, jadi ia ditolak alih-alih dinormalkan
  //   '12-c'   huruf kecil
  //   'abc'    tanpa pemisah
  //   '1--A'   pemisah ganda

  const malformed = await bulkCreate('malformed codes are filtered, not normalised', {
    codes: ['0-A', '012-C', '12-c', 'abc', '1--A', '11-A'],
  });
  assertCodeSet(
    'every malformed shape is reported',
    malformed.rejected_malformed,
    ['0-A', '012-C', '12-c', 'abc', '1--A'],
    'Non-canonical codes are rejected, never repaired -- see the head of migration 062 section 1.'
  );
  assertCodesInOrder('the one well-formed code in the call is still created', malformed.created_codes, ['11-A'],
    'Malformed neighbours must not cancel a valid position.');

  const normalisedProbe = await expectSuccess(
    STAGE,
    "'012-C' did not sneak in as '12-C'",
    owner.client.from('trees').select('id').eq('farm_id', farm.id).eq('tree_code', '12-C'),
    'A normalised code would be created under a name the caller never sent.'
  );
  assertEqual(STAGE, 'no tree was created from the leading-zero code', normalisedProbe.length, 0,
    "'012-C' must be rejected outright, not silently turned into '12-C'.");

  // ---------- 7. Kosong, duplikat, dan ember yang saling lepas ----------

  const blanks = await bulkCreate('null and whitespace entries are counted, not listed', {
    codes: ['5-C', null, '   '],
  });
  assertEqual(STAGE, 'blank entries are counted', blanks.blank_count, 2,
    'NULL and whitespace-only strings carry nothing a user could act on, so they are counted.');
  assertEmptyBuckets(
    'blank entries do not appear in any rejection bucket',
    blanks,
    "A blank entry has no code to report -- printing '   ' back tells the user nothing."
  );
  assertCodesInOrder('the valid code alongside the blanks is created', blanks.created_codes, ['5-C'],
    'Blanks must not cancel the rest of the set.');

  // Duplikat diuji sendiri, tidak hanya di dalam panggilan campuran di bawah.
  // Kegagalannya bukan "satu kode salah ember" melainkan SELURUH transaksi
  // pecah dengan 'duplicate key value violates unique constraint', dan pesan
  // itu pantas muncul dari asersi yang tidak menguji apa-apa selain ini.
  const duplicates = await bulkCreate('a repeated code does not break the transaction', {
    codes: ['7-C', '7-C', '7-D'],
  });
  assertCodesInOrder('a repeated code is created exactly once', duplicates.created_codes, ['7-C', '7-D'],
    'Deduplication happens before insert -- without it the unique constraint aborts everything.');
  assertCodeSet('the repeated code is reported as a duplicate', duplicates.duplicate_codes, ['7-C'],
    'duplicate_codes tells the caller why fewer trees were born than codes sent.');

  // Satu panggilan yang menyentuh SEMUA jalur sekaligus. Yang diujinya bukan
  // tiap ember satu per satu -- itu sudah di atas -- melainkan bahwa embernya
  // SALING LEPAS saat alasannya bercampur.
  const mixed = await bulkCreate('mixed reasons land in exactly one bucket each', {
    codes: ['8-A', '8-A', '2-A', outOfGridByRow, 'zzz', null, '   ', '9-C'],
  });
  assertCodesInOrder('the valid codes are created', mixed.created_codes, ['8-A', '9-C'],
    'A mixed call must still create everything that passes.');
  assertCodesInOrder('the occupied code is in its own bucket', mixed.rejected_occupied, ['2-A'], 'Occupied.');
  assertCodesInOrder('the out-of-grid code is in its own bucket', mixed.rejected_out_of_grid, [outOfGridByRow],
    'Out of grid.');
  assertCodeSet('the malformed code is in its own bucket', mixed.rejected_malformed, ['zzz'], 'Malformed.');
  assertEqual(STAGE, 'the blanks are counted in the mixed call', mixed.blank_count, 2, 'Two blank entries.');

  const rejectedAll = [
    ...(mixed.rejected_occupied ?? []),
    ...(mixed.rejected_out_of_grid ?? []),
    ...(mixed.rejected_malformed ?? []),
  ];
  assertEqual(STAGE, 'no code appears in two rejection buckets', rejectedAll.length, new Set(rejectedAll).size,
    'Filtering is layered -- shape, then grid, then occupancy -- so a code can only be rejected once.');
  assertCondition(
    STAGE,
    'no rejected code was also created',
    rejectedAll.every((code) => !(mixed.created_codes ?? []).includes(code)),
    `Overlap: ${JSON.stringify(rejectedAll.filter((code) => (mixed.created_codes ?? []).includes(code)))}`,
    'A rejected position must not exist afterwards.'
  );

  // duplicate_codes SENGAJA tidak ikut pemeriksaan saling-lepas di atas: ia
  // bukan ember penolakan. Kode yang dikirim dua kali TETAP DIBUAT sekali, dan
  // karenanya HARUS muncul di dua tempat. Itu kontraknya, bukan kebocoran.
  assertCodeSet('the duplicate in the mixed call is reported', mixed.duplicate_codes, ['8-A'],
    'duplicate_codes is informational.');
  assertCondition(
    STAGE,
    'a duplicated code appears in BOTH duplicate_codes and created_codes',
    (mixed.created_codes ?? []).includes('8-A'),
    "'8-A' is missing from created_codes.",
    'Sending a code twice creates it once -- it is not a rejection.'
  );

  // ---------- 8. HAK AKSES ----------
  //
  // Bagian paling bernilai di stage ini: satu-satunya bagian yang tidak bisa
  // dibuktikan verifikasi manual lewat SQL Editor, karena set_config tidak
  // melewati PostgREST maupun RLS sungguhan.
  //
  // Ketiga pelaku menyasar posisi yang BERBEDA dan belum pernah dipakai, supaya
  // pemeriksaan "tidak ada baris baru" di bawah bisa menunjuk posisi tertentu,
  // bukan sekadar angka jumlah.

  const beforeDenied = await readCounts('before denied calls');

  const workerError = await expectFailure(
    STAGE,
    'an active worker cannot create trees in bulk',
    worker.client.rpc('create_trees_at_positions', {
      p_farm_id: farm.id,
      p_planted_at: null,
      p_position_codes: ['12-A'],
      p_variety: null,
    }),
    'Only active owners may add trees. An active worker is the case that catches a lost role filter.'
  );

  // Pesannya dibandingkan dengan create_tree_with_planting APA ADANYA, bukan
  // hanya dengan teks yang ditulis di atas. Yang dijaga bukan kalimatnya
  // melainkan KESAMAANNYA: sisi aplikasi sudah menangani galat dari fungsi lama,
  // dan pesan yang menyimpang berarti cabang penanganan baru untuk keadaan yang
  // persis sama.
  const legacyWorkerError = await expectFailure(
    STAGE,
    'an active worker cannot create a single tree either',
    worker.client.rpc('create_tree_with_planting', {
      p_column_position: 'A',
      p_farm_id: farm.id,
      p_planted_at: null,
      p_row_position: 12,
      p_variety: null,
    }),
    'create_tree_with_planting has always refused workers -- this reads its message for comparison.'
  );

  assertEqual(
    STAGE,
    'bulk and single creation refuse workers with the identical message',
    workerError?.message ?? '',
    legacyWorkerError?.message ?? '',
    'Migration 062 reuses the message verbatim so the app needs no new error branch.'
  );
  assertCondition(
    STAGE,
    'the refusal names active ownership',
    (workerError?.message ?? '').includes(OWNER_ONLY_MESSAGE),
    `Expected a message containing "${OWNER_ONLY_MESSAGE}", got "${workerError?.message ?? ''}"`,
    'The wording is what the owner reads in the field, so it is part of the contract.'
  );

  await expectFailure(
    STAGE,
    'a registered non-member cannot create trees in bulk',
    outsider.client.rpc('create_trees_at_positions', {
      p_farm_id: farm.id,
      p_planted_at: null,
      p_position_codes: ['13-A'],
      p_variety: null,
    }),
    'is_active_owner must match on farm_id too -- a non-member has no membership row at all.'
  );

  await expectFailure(
    STAGE,
    'anon cannot execute the bulk creation function',
    anonClient.rpc('create_trees_at_positions', {
      p_farm_id: farm.id,
      p_planted_at: null,
      p_position_codes: ['14-A'],
      p_variety: null,
    }),
    'EXECUTE is revoked from public and anon (migration 062 section 5); only authenticated holds it.'
  );

  const afterDenied = await readCounts('after denied calls');
  assertEqual(STAGE, 'denied calls create no tree rows', afterDenied.trees - beforeDenied.trees, 0,
    'The access guard runs before anything is written.');
  assertEqual(STAGE, 'denied calls create no planting rows', afterDenied.plantings - beforeDenied.plantings, 0,
    'Nothing may be written by a call that is refused.');

  const deniedPositions = await expectSuccess(
    STAGE,
    'none of the refused positions exists',
    owner.client.from('trees').select('tree_code').eq('farm_id', farm.id).in('tree_code', ['12-A', '13-A', '14-A']),
    'A refused call must leave no trace at the position it targeted.'
  );
  assertEqual(STAGE, 'the three refused positions are still empty', deniedPositions.length, 0,
    'A partially applied refusal would leave a tree row that can never be deleted.');

  // ---------- 9. Masukan kosong ----------
  //
  // Konsisten dengan keputusan nol-sah di bagian 5: tidak ada yang perlu
  // dilindungi exception, karena nol baris ditulis dengan atau tanpa dia.

  const emptyArray = await bulkCreate('an empty array succeeds with an empty report', { codes: [] });
  assertCodesInOrder('an empty array creates nothing', emptyArray.created_codes, [], 'Nothing was asked for.');
  assertEmptyBuckets('an empty array rejects nothing', emptyArray, 'Nothing was asked for.');
  assertEqual(STAGE, 'an empty array reports no blanks', emptyArray.blank_count, 0, 'Nothing was asked for.');

  const nullArray = await bulkCreate('a null array succeeds with an empty report', { codes: null });
  assertCodesInOrder('a null array creates nothing', nullArray.created_codes, [],
    "coalesce(p_position_codes, '{}') must treat NULL as an empty set, not as an error.");
  assertEqual(STAGE, 'a null array reports no blanks', nullArray.blank_count, 0, 'Nothing was asked for.');

  // ---------- 10. Pagar ukuran ----------
  //
  // DISENGAJA PALING AKHIR. Panggilan ini mengirim badan permintaan sekitar
  // 150 KB, dan batas ukuran badan permintaan pada proyek Supabase ini tidak
  // bisa diperiksa dari repo. Kalau ia gagal karena infrastruktur dan bukan
  // karena logika, seluruh asersi di atas sudah tercetak lolos lebih dulu.
  //
  // Seluruh elemennya sengaja identik: pagar ukuran berbunyi SEBELUM
  // deduplikasi dan sebelum penguraian bentuk, jadi isinya tidak penting dan
  // kode terpendek yang sah adalah muatan termurah yang bisa dikirim.

  const beforeOversize = await readCounts('before oversize call');

  await expectFailure(
    STAGE,
    'a request larger than the biggest possible grid is refused',
    owner.client.rpc('create_trees_at_positions', {
      p_farm_id: farm.id,
      p_planted_at: null,
      p_position_codes: Array.from({ length: POSITION_LIMIT + 1 }, () => '1-A'),
      p_variety: null,
    }),
    `The limit is ${POSITION_LIMIT} (999 x 26). If this fails with a payload or timeout error instead of the limit message, it is infrastructure, not migration 062.`
  );

  const afterOversize = await readCounts('after oversize call');
  assertEqual(STAGE, 'the refused oversize call wrote nothing', afterOversize.trees - beforeOversize.trees, 0,
    'The size guard runs before the farm is even read.');
});
