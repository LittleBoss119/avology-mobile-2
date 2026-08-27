import { assertEnv } from './config.mjs';
import {
  approveWorker,
  assertCondition,
  assertEqual,
  createAnonClient,
  createFarmWithOwner,
  createIsolatedFarmWithWorker,
  expectDeniedOrNoRows,
  expectFailure,
  expectSuccess,
  findFreeTreePosition,
  firstRpcRow,
  joinWorkerToFarm,
  makeRunId,
  pass,
  runStage,
  signUpActor,
  todayIso,
} from './test-utils.mjs';

// Jaring pengaman untuk enam policy foto dan seluruh CHECK constraint
// photo_attachments. Sebelum stage ini, cakupannya NOL: baseline hijau tidak
// menjamin apa pun tentang siapa yang boleh mengunggah, membaca, atau menghapus
// foto.
//
// Definisi yang diuji:
//   * tiga policy public.photo_attachments  -- migrasi 060 bagian 3.1
//                                              (asal 053 E.1, + cabang keempat)
//   * tiga policy storage.objects           -- migrasi 060 bagian 3.2
//                                              (asal 053 E.2, + cabang keempat)
//   * empat fungsi pendukung                -- migrasi 019 (126, 145, 207, 232)
//   * dua fungsi pendukung                  -- migrasi 060 bagian 2
//   * trigger set_photo_attachment_planting -- migrasi 059 bagian 4, ditulis
//                                              ulang di 060 bagian 5
//   * CHECK entity_type / folder / entity_id / farm_id / file_size / mime_type
//
// YANG PALING PENTING DI SINI ADALAH ASERSI PENOLAKAN.
//
// Tes yang hanya membuktikan jalur sukses tidak akan menangkap policy yang
// terlalu longgar, dan longgar justru kegagalan paling berbahaya untuk tabel
// ini: satu cabang `or` yang kelewat lebar membuka seluruh foto satu kebun ke
// kebun lain. Karena itu setiap "boleh" di bawah selalu berpasangan dengan
// "tidak boleh" dari pelaku yang paling mirip dengannya.
//
// TIGA BENTUK PENOLAKAN YANG BERBEDA, jangan tertukar:
//   INSERT ditolak  -> galat RLS            -> expectFailure
//   SELECT ditolak  -> 0 baris, TANPA galat -> hitung barisnya, jangan expectFailure
//   DELETE ditolak  -> 0 baris terhapus, TANPA galat -> periksa barisnya masih ada
// DELETE yang "berhasil tanpa galat" karena tidak menyentuh apa pun adalah
// jebakan paling gampang di lapisan ini.
//
// Stage ini berdiri sendiri seperti 09, 10, 14, 15, dan 16: seluruh pelaku,
// kebun, pohon, dan tugasnya dibuat di dalam tes, dan ia tidak membaca maupun
// menulis .db-test-state.local.json. Itu syarat, bukan gaya -- ia menyelesaikan
// tugas dan menulis baris photo_attachments, dan kalau dijalankan di kebun
// bersama milik stage 01 ia akan menggeser hitungan yang diperiksa stage 06.

const STAGE = '17 photo attachment policies';
const BUCKET = 'avology-photos';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

// Empat bita: penanda awal dan akhir JPEG. Isinya tidak pernah diperiksa siapa
// pun di jalur ini -- yang diperiksa RLS adalah nama objek dan pengunggahnya --
// jadi muatan sekecil mungkin sudah cukup dan tidak membebani jaringan.
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

await runStage(STAGE, async () => {
  assertEnv();

  const runId = makeRunId();

  // ---------- Pelaku ----------
  //
  // Enam sudut pandang, masing-masing menutup satu cabang policy yang berbeda:
  //   owner    -- owner aktif kebun A
  //   worker   -- pekerja aktif kebun A, pelapor kondisi DAN pelaksana tugas
  //   mate     -- pekerja aktif LAIN di kebun A yang sama
  //   ownerB   -- owner aktif kebun LAIN
  //   outsider -- pengguna terdaftar tanpa kebun
  //   anon     -- belum masuk sama sekali
  //
  // `mate` adalah pelaku terpenting di stage ini. Ia anggota aktif yang sah,
  // jadi ia satu-satunya yang bisa membedakan "boleh karena anggota" dari
  // "boleh karena pelapor/pelaksana". Tanpa dia, policy yang melonggar dari
  // "pelapor" jadi "anggota mana pun" akan lolos tanpa suara.
  const { owner, worker, farm } = await createIsolatedFarmWithWorker(STAGE, {
    runId,
    slug: 'photopolicy',
    workerPhone: '081999017001',
  });

  const mate = await signUpActor({
    runId,
    label: 'avology-photopolicy-mate',
    fullName: `Mate photopolicy ${runId}`,
    phone: '081999017002',
  });
  const mateMembershipId = firstRpcRow(
    await joinWorkerToFarm(STAGE, mate.client, farm.join_code)
  );
  await approveWorker(STAGE, owner.client, mateMembershipId);

  const ownerB = await signUpActor({
    runId,
    label: 'avology-photopolicy-ownerb',
    fullName: `Owner B photopolicy ${runId}`,
    phone: '081999017003',
  });
  const farmB = await createFarmWithOwner(STAGE, ownerB, {
    name: `Kebun lain photopolicy ${runId}`,
    location: 'Lokasi lain',
    areaSize: 500,
  });

  const outsider = await signUpActor({
    runId,
    label: 'avology-photopolicy-outsider',
    fullName: `Outsider photopolicy ${runId}`,
    phone: '081999017004',
  });

  // Pelamar yang belum disetujui: BARISNYA ADA di farm_members kebun A, tapi
  // status-nya 'pending'. Ia beda dari outsider dan justru lebih berbahaya --
  // seluruh penjagaan foto bersandar pada is_active_farm_member / is_active_owner
  // / is_active_worker, yang ketiganya menyaring status = 'active'. Kalau saringan
  // status itu hilang dari salah satunya, outsider tetap tertolak dan hanya
  // pelaku inilah yang akan menunjukkannya.
  const pending = await signUpActor({
    runId,
    label: 'avology-photopolicy-pending',
    fullName: `Pending photopolicy ${runId}`,
    phone: '081999017005',
  });
  await joinWorkerToFarm(STAGE, pending.client, farm.join_code);

  const anonClient = createAnonClient();

  // ---------- Bahan uji: satu pohon, satu catatan kondisi, satu aktivitas ----------

  // Koordinatnya DITURUNKAN dari grid kebun ini, tidak diketik. Stage ini tidak
  // pernah memeriksa tree_code, jadi posisi mana pun yang bebas sama saja
  // baiknya -- dan menebaknya berarti tes ini pecah begitu grid kebun uji
  // berubah lewat set_farm_grid.
  const treePosition = await findFreeTreePosition(STAGE, owner.client, farm.id);

  const treeId = await expectSuccess(
    STAGE,
    'owner creates a tree with its first planting',
    owner.client.rpc('create_tree_with_planting', {
      p_farm_id: farm.id,
      p_row_position: treePosition.rowPosition,
      p_column_position: treePosition.columnPosition,
      p_variety: 'Alpukat Mentega',
      p_planted_at: todayIso(),
    }),
    'Check create_tree_with_planting(uuid, smallint, text, text, date).'
  );

  // Pelapornya SENGAJA pekerja, bukan owner. can_upload_condition_record_photo
  // menuntut tcr.reported_by = pengunggah; kalau pelapornya owner, cabang
  // "owner boleh apa saja" akan menutupi cabang pelapor dan asersinya kehilangan
  // arti.
  const conditionRecord = await expectSuccess(
    STAGE,
    'worker files a condition report as its reporter',
    worker.client
      .from('tree_condition_reports')
      .insert({
        farm_id: farm.id,
        tree_id: treeId,
        reported_by: worker.userId,
        condition_status: 'needs_attention',
        note: `Photo policy fixture ${runId}`,
      })
      .select('id')
      .single(),
    'Active farm members should be able to insert condition reports for farm trees.'
  );
  const conditionRecordId = conditionRecord.id;

  const schedule = firstRpcRow(
    await expectSuccess(
      STAGE,
      'owner schedules a task for the worker',
      owner.client.rpc('create_manual_schedule', {
        p_farm_id: farm.id,
        p_title: `Siram pohon ${runId}`,
        p_category: 'watering',
        p_scheduled_date: todayIso(),
        p_assigned_worker_id: worker.userId,
        p_target_type: 'tree',
        p_target_tree_ids: [treeId],
        p_custom_target_note: null,
        p_instruction: 'Siram pohonnya',
        p_repeat_every_days: null,
      }),
      'Check create_manual_schedule after migration 057 (p_target_tree_ids uuid[]).'
    )
  );
  const taskId = schedule.task_id;

  const activityId = await expectSuccess(
    STAGE,
    'worker completes the task and produces an activity',
    worker.client.rpc('complete_task', {
      p_task_id: taskId,
      p_note: 'Sudah disiram',
    }),
    'Check complete_task(uuid, text, text, numeric, text).'
  );

  // entity_id untuk task_proof menunjuk care_activities.id, BUKAN care_tasks.id.
  // Nomor tugasnya tetap dipakai, tapi hanya sebagai segmen keempat path.
  assertCondition(
    STAGE,
    'task_proof fixtures point at an activity id, not a task id',
    Boolean(activityId) && activityId !== taskId,
    'complete_task must return the new care_activities id.',
    'Check migration 043 complete_task return value.'
  );

  // ---------- Pembantu ----------

  // Bentuk path ditegakkan CHECK constraint, bukan konvensi. Cabang task-proofs
  // punya SATU segmen lebih banyak: entity_id-nya di segmen kelima, dan segmen
  // keempatnya nomor tugas (migrasi 019, avology_storage_path_entity_id).
  function photoPath({ folder, entityId, farmId = farm.id, taskIdSegment = taskId, label }) {
    if (folder === 'trees') {
      return `farms/${farmId}/trees/${entityId}/main/${label}-${runId}.jpg`;
    }

    if (folder === 'task-proofs') {
      return `farms/${farmId}/task-proofs/${taskIdSegment}/${entityId}/${label}-${runId}.jpg`;
    }

    return `farms/${farmId}/${folder}/${entityId}/${label}-${runId}.jpg`;
  }

  function photoRow({ entityType, entityId, storagePath, uploadedBy, overrides = {} }) {
    return {
      bucket: BUCKET,
      entity_id: entityId,
      entity_type: entityType,
      farm_id: farm.id,
      file_name: 'foto.jpg',
      file_size: 2048,
      is_primary: entityType === 'tree_main',
      mime_type: 'image/jpeg',
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      ...overrides,
    };
  }

  function insertPhoto(client, row) {
    return client.from('photo_attachments').insert(row).select('id').single();
  }

  // Berapa baris yang TERLIHAT oleh satu klien untuk satu id.
  //
  // Sengaja tidak memakai expectSuccess/expectFailure: SELECT yang ditolak RLS
  // mengembalikan 0 baris TANPA galat, jadi yang diperiksa jumlah barisnya, dan
  // galat apa pun di sini adalah kegagalan tes yang sebenarnya.
  async function visibleCount(client, photoId) {
    const result = await client.from('photo_attachments').select('id').eq('id', photoId);

    if (result.error) {
      return { count: null, error: result.error };
    }

    return { count: result.data?.length ?? 0, error: null };
  }

  async function assertVisible(operation, client, photoId, cause) {
    const { count, error } = await visibleCount(client, photoId);
    assertCondition(STAGE, operation, error === null && count === 1,
      error ? `Unexpected error: ${error.message}` : `Expected 1 visible row, got ${count}`, cause);
  }

  async function assertHidden(operation, client, photoId, cause) {
    const { count, error } = await visibleCount(client, photoId);
    assertCondition(STAGE, operation, error === null && count === 0,
      error ? `Unexpected error: ${error.message}` : `Expected 0 visible rows, got ${count}`, cause);
  }

  // DELETE yang ditolak RLS TIDAK melempar galat -- ia menghapus nol baris dan
  // melapor sukses. Karena itu penolakan diperiksa dua kali: nol baris yang
  // dikembalikan .select(), DAN barisnya memang masih ada saat dibaca owner.
  // Tanpa pemeriksaan kedua, policy yang menghapus diam-diam akan lolos.
  async function assertDeleteBlocked(operation, client, photoId, cause) {
    const result = await client.from('photo_attachments').delete().eq('id', photoId).select('id');

    if (result.error) {
      // Galat juga bentuk penolakan yang sah; yang tidak sah cuma penghapusan
      // yang benar-benar terjadi.
      pass(`${operation} (denied with an error)`);
      return;
    }

    const removed = result.data?.length ?? 0;
    const { count } = await visibleCount(owner.client, photoId);

    assertCondition(STAGE, operation, removed === 0 && count === 1,
      `Expected 0 rows deleted and the row to survive; deleted=${removed}, ownerSees=${count}`, cause);
  }

  async function assertDeleteAllowed(operation, client, photoId, cause) {
    const removed = await expectSuccess(
      STAGE,
      `${operation} (delete returns the removed row)`,
      client.from('photo_attachments').delete().eq('id', photoId).select('id'),
      cause
    );
    assertEqual(STAGE, operation, removed?.length ?? 0, 1, cause);
  }

  // ================================================================
  // 1. Yang berhak unggah, berhasil
  // ================================================================

  const treeMainPath = photoPath({ folder: 'trees', entityId: treeId, label: 'main' });
  const treeMainPhoto = await expectSuccess(
    STAGE,
    'owner uploads a tree_main photo',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: treeMainPath,
        uploadedBy: owner.userId,
      })
    ),
    'tree_main insert requires is_active_owner(farm_id, auth.uid()).'
  );

  const conditionPath = photoPath({
    folder: 'condition-reports',
    entityId: conditionRecordId,
    label: 'kondisi',
  });
  const conditionPhoto = await expectSuccess(
    STAGE,
    'the reporting worker uploads a photo for their own condition record',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: conditionPath,
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_condition_record_photo requires tcr.reported_by = auth.uid().'
  );

  const taskProofPath = photoPath({
    folder: 'task-proofs',
    entityId: activityId,
    label: 'bukti',
  });
  const taskProofPhoto = await expectSuccess(
    STAGE,
    'the assigned worker uploads a task_proof photo for their own activity',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: taskProofPath,
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_task_proof_photo requires ca.performed_by = ct.assigned_to = auth.uid().'
  );

  // ================================================================
  // 2. Yang tidak berhak unggah, ditolak
  // ================================================================

  await expectFailure(
    STAGE,
    'another active member cannot upload a photo for a condition record that is not theirs',
    insertPhoto(
      mate.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'kondisi-mate',
        }),
        uploadedBy: mate.userId,
      })
    ),
    'THE most dangerous loosening here: an active member is not the reporter. can_upload_condition_record_photo must keep the reported_by test.'
  );

  await expectFailure(
    STAGE,
    'a worker cannot upload a tree_main photo',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'main-worker' }),
        uploadedBy: worker.userId,
      })
    ),
    'tree_main is owner-only on insert (migration 053 E.1).'
  );

  await expectFailure(
    STAGE,
    'another active member cannot upload a task_proof for someone else activity',
    insertPhoto(
      mate.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'bukti-mate' }),
        uploadedBy: mate.userId,
      })
    ),
    'can_upload_task_proof_photo requires the uploader to be both performer and assignee.'
  );

  // Owner memang boleh menghapus foto siapa pun, tapi TIDAK boleh mengunggah
  // bukti kerja atas nama pekerjanya: cabang task_proof tidak punya jalur owner.
  await expectFailure(
    STAGE,
    'even the owner cannot upload a task_proof for the worker activity',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'bukti-owner' }),
        uploadedBy: owner.userId,
      })
    ),
    'The insert policy has no owner branch for task_proof; only the performing assignee may upload it.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot upload a tree_main photo',
    insertPhoto(
      outsider.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'main-outsider' }),
        uploadedBy: outsider.userId,
      })
    ),
    'Non-members must fail every branch of the insert policy.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot upload a condition_record photo',
    insertPhoto(
      outsider.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'kondisi-outsider',
        }),
        uploadedBy: outsider.userId,
      })
    ),
    'Non-members must fail every branch of the insert policy.'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot upload a condition_record photo',
    insertPhoto(
      pending.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'kondisi-pending',
        }),
        uploadedBy: pending.userId,
      })
    ),
    'is_active_farm_member filters on status = active; a pending row must not qualify.'
  );

  await expectFailure(
    STAGE,
    'the owner of another farm cannot upload into this farm',
    insertPhoto(
      ownerB.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'main-ownerb' }),
        uploadedBy: ownerB.userId,
      })
    ),
    'is_active_owner is scoped per farm; owning farm B grants nothing in farm A.'
  );

  // Pemalsuan uploaded_by. Kalau `uploaded_by = auth.uid()` hilang dari policy,
  // siapa pun yang lolos satu cabang bisa menandatangani foto atas nama orang
  // lain -- dan cabang hapus "pengunggah boleh" jadi ikut bisa disalahgunakan.
  await expectFailure(
    STAGE,
    'a member cannot attribute an upload to somebody else',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'kondisi-spoof',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'The insert policy pins uploaded_by = auth.uid().'
  );

  // ================================================================
  // 3. Baca
  // ================================================================

  await assertVisible('owner reads the tree_main photo', owner.client, treeMainPhoto.id,
    'tree_main select is open to every active farm member.');
  await assertVisible('owner reads the condition photo', owner.client, conditionPhoto.id,
    'can_access_condition_record_photo allows every active farm member.');
  await assertVisible('owner reads the task_proof photo', owner.client, taskProofPhoto.id,
    'can_access_task_proof_photo has an explicit is_active_owner branch.');

  await assertVisible('the reporting worker reads their own condition photo', worker.client,
    conditionPhoto.id, 'The reporter is an active member, so the read branch applies.');
  await assertVisible('the performing worker reads their own task_proof photo', worker.client,
    taskProofPhoto.id, 'The performer is still the assignee, so the worker read branch applies.');

  await assertVisible('another active member reads the tree_main photo', mate.client,
    treeMainPhoto.id, 'tree_main select is open to every active farm member.');
  await assertVisible('another active member reads the condition photo', mate.client,
    conditionPhoto.id, 'can_access_condition_record_photo allows every active farm member, not just the reporter.');

  // PERHATIAN, ini BUKAN kebocoran dan bukan kesalahan tes.
  //
  // can_access_task_proof_photo TIDAK membuka bukti kerja ke seluruh anggota
  // aktif. Cabangnya cuma dua: owner aktif, atau pekerja yang SEKALIGUS
  // pelaksana dan penerima tugas itu. Pekerja lain di kebun yang sama tidak
  // termasuk. Asersi ini mengunci perilaku tersebut supaya penulisan ulang
  // policy tidak diam-diam memperlebarnya jadi "anggota mana pun".
  await assertHidden('another active member cannot read the task_proof photo', mate.client,
    taskProofPhoto.id, 'task_proof read is owner + performing assignee only, by design.');

  await assertHidden('the owner of another farm reads nothing', ownerB.client, treeMainPhoto.id,
    'Every read branch is farm-scoped.');
  await assertHidden('the owner of another farm cannot read the condition photo', ownerB.client,
    conditionPhoto.id, 'Every read branch is farm-scoped.');
  await assertHidden('a non-member reads nothing', outsider.client, treeMainPhoto.id,
    'Non-members satisfy no read branch.');
  await assertHidden('a non-member cannot read the condition photo', outsider.client,
    conditionPhoto.id, 'Non-members satisfy no read branch.');

  await assertHidden('a pending applicant cannot read the tree_main photo', pending.client,
    treeMainPhoto.id, 'A pending farm_members row is not an active membership.');
  await assertHidden('a pending applicant cannot read the condition photo', pending.client,
    conditionPhoto.id, 'A pending farm_members row is not an active membership.');

  // Anon ditangani terpisah: helper policy di-revoke dari role anon (migrasi
  // 013/019), sementara keenam policy sengaja dibiarkan tanpa klausa
  // `to authenticated` (migrasi 053 bagian E). Akibatnya anon bisa ditolak
  // lewat GALAT izin fungsi, bukan lewat policy yang bernilai false. Keduanya
  // sama-sama penolakan, jadi asersinya menerima dua-duanya.
  await expectDeniedOrNoRows(
    STAGE,
    'an anonymous client cannot read photo metadata',
    anonClient.from('photo_attachments').select('id').eq('id', treeMainPhoto.id),
    'Anonymous access must never reach photo rows.'
  );

  // ================================================================
  // 4. Tidak ada jalur UPDATE sama sekali
  // ================================================================
  //
  // Migrasi 013 dan 019 hanya memberi grant select/insert/delete, dan tidak ada
  // satu pun policy UPDATE. Foto karenanya bersifat sekali-tulis.
  //
  // PENOLAKANNYA SENYAP, dan ini sudah diverifikasi langsung ke database:
  // UPDATE mengembalikan sukses dengan NOL baris, bukan galat, dan nilai
  // kolomnya tidak berubah. Bentuk itu penting -- kalau suatu saat ada yang
  // menambahkan policy UPDATE, tidak akan ada galat baru yang muncul di mana
  // pun; yang berubah hanya jumlah baris terpengaruh, dari nol jadi satu.
  // Asersi di bawah karena itu memeriksa DUA hal: nol baris terpengaruh, DAN
  // nilai lamanya masih utuh saat dibaca ulang.

  async function assertUpdateBlocked(operation, client, photoId, cause) {
    const before = await expectSuccess(
      STAGE,
      `${operation} (read caption before)`,
      client.from('photo_attachments').select('caption').eq('id', photoId).single(),
      cause
    );

    const result = await client
      .from('photo_attachments')
      .update({ caption: `diubah-${runId}` })
      .eq('id', photoId)
      .select('id');

    if (result.error) {
      pass(`${operation} (denied with an error)`);
      return;
    }

    const changed = result.data?.length ?? 0;
    const after = await expectSuccess(
      STAGE,
      `${operation} (read caption after)`,
      owner.client.from('photo_attachments').select('caption').eq('id', photoId).single(),
      cause
    );

    assertCondition(
      STAGE,
      operation,
      changed === 0 && after.caption === before.caption,
      `Expected 0 rows updated and the caption untouched; updated=${changed}, caption=${after.caption}`,
      cause
    );
  }

  await assertUpdateBlocked(
    'nobody can update a photo row, not even its uploader',
    worker.client,
    conditionPhoto.id,
    'photo_attachments has no UPDATE policy; every update must affect zero rows.'
  );

  await assertUpdateBlocked(
    'the owner cannot update a photo row either',
    owner.client,
    treeMainPhoto.id,
    'The owner has no UPDATE branch either -- photo rows are write-once.'
  );

  // ================================================================
  // 5. Hapus yang ditolak
  // ================================================================

  await assertDeleteBlocked(
    'another active member cannot delete the condition photo',
    mate.client,
    conditionPhoto.id,
    'The delete policy needs uploaded_by = auth.uid() AND can_upload_condition_record_photo.'
  );

  await assertDeleteBlocked(
    'another active member cannot delete the tree_main photo',
    mate.client,
    treeMainPhoto.id,
    'tree_main has no uploader branch on delete; only an active owner may remove it.'
  );

  await assertDeleteBlocked(
    'the owner of another farm cannot delete anything here',
    ownerB.client,
    treeMainPhoto.id,
    'is_active_owner is farm-scoped.'
  );

  await assertDeleteBlocked(
    'a non-member cannot delete anything',
    outsider.client,
    conditionPhoto.id,
    'Non-members satisfy no delete branch.'
  );

  await assertDeleteBlocked(
    'a pending applicant cannot delete anything',
    pending.client,
    conditionPhoto.id,
    'A pending farm_members row satisfies neither is_active_owner nor the uploader branch.'
  );

  // Pekerja adalah pengunggah tree_main? Bukan -- owner yang mengunggahnya.
  // Asersi ini memastikan cabang "pengunggah boleh" tidak diam-diam melebar ke
  // tree_main, yang di policy hidup memang tidak punya cabang itu.
  await assertDeleteBlocked(
    'the reporting worker cannot delete the owner tree_main photo',
    worker.client,
    treeMainPhoto.id,
    'The uploader branch of the delete policy covers condition_record and task_proof only.'
  );

  // ================================================================
  // 6. Hapus yang diizinkan
  // ================================================================

  // Satu baris bukti kerja tambahan, khusus untuk menguji cabang pengunggah
  // pada task_proof. Baris aslinya disisakan untuk cabang owner di bawah.
  const secondTaskProof = await expectSuccess(
    STAGE,
    'the worker uploads a second task_proof photo',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'bukti-2' }),
        uploadedBy: worker.userId,
      })
    ),
    'A second proof row is allowed; nothing constrains photos to one per entity.'
  );

  await assertDeleteAllowed(
    'the uploader who is also the reporter deletes their own condition photo',
    worker.client,
    conditionPhoto.id,
    'Delete allows uploaded_by = auth.uid() together with can_upload_condition_record_photo.'
  );

  await assertDeleteAllowed(
    'the uploader who is also the assignee deletes their own task_proof photo',
    worker.client,
    secondTaskProof.id,
    'Delete allows uploaded_by = auth.uid() together with can_access_task_proof_photo.'
  );

  await assertDeleteAllowed(
    'the owner deletes a photo uploaded by somebody else',
    owner.client,
    taskProofPhoto.id,
    'is_active_owner is the first branch of the delete policy and covers every entity type.'
  );

  await assertDeleteAllowed(
    'the owner deletes the tree_main photo',
    owner.client,
    treeMainPhoto.id,
    'tree_main delete is owner-only.'
  );

  // ================================================================
  // 7. CHECK constraint: path, entity_type, ukuran, mime
  // ================================================================
  //
  // Seluruh asersi di bawah dijalankan oleh pelaku yang SEHARUSNYA BOLEH
  // mengunggah bentuk itu. Kalau dijalankan pelaku yang tidak berhak, insert-nya
  // tetap gagal -- tapi gagal karena RLS, dan asersinya lolos karena alasan yang
  // salah. Pelakunya dipilih dengan sengaja: owner untuk tree_main, pekerja
  // pelapor/pelaksana untuk dua sisanya.

  const otherFarmId = farmB.id;

  // Segmen kedua path harus sama dengan farm_id barisnya. Ditangkap DUA lapis
  // sekaligus: policy insert (avology_storage_path_farm_id = farm_id) dan CHECK
  // photo_attachments_storage_path_farm_check. Yang diuji di sini bahwa ia
  // ditolak, bukan lapis mana yang menolaknya lebih dulu.
  await expectFailure(
    STAGE,
    'a storage_path whose farm segment points at another farm is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({
          folder: 'trees',
          entityId: treeId,
          farmId: otherFarmId,
          label: 'salah-farm',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'Both the insert policy and photo_attachments_storage_path_farm_check pin segment 2 to farm_id.'
  );

  // Folder entitas TIDAK diperiksa policy -- hanya CHECK yang menangkapnya.
  // Ini satu-satunya asersi path di sini yang mengisolasi CHECK constraint
  // sepenuhnya dari RLS.
  await expectFailure(
    STAGE,
    'a tree_main row stored under the condition-reports folder is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: `farms/${farm.id}/condition-reports/${treeId}/salah-folder-${runId}.jpg`,
        uploadedBy: owner.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps each entity_type to exactly one folder.'
  );

  await expectFailure(
    STAGE,
    'a condition_record row stored under the trees folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: `farms/${farm.id}/trees/${conditionRecordId}/main/salah-folder2-${runId}.jpg`,
        uploadedBy: worker.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps each entity_type to exactly one folder.'
  );

  await expectFailure(
    STAGE,
    'a storage_path whose entity segment is not the entity_id is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: treeId,
          label: 'salah-entity',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Both the insert policy and photo_attachments_storage_path_entity_id_check pin segment 4 to entity_id.'
  );

  // Cabang khusus task-proofs. avology_storage_path_entity_id membaca segmen
  // KELIMA untuk folder ini; path empat segmen yang "terlihat benar" untuk
  // entitas lain justru salah di sini, karena segmen keempatnya nomor tugas.
  await expectFailure(
    STAGE,
    'a task_proof path without the task segment is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: `farms/${farm.id}/task-proofs/${activityId}/kurang-segmen-${runId}.jpg`,
        uploadedBy: worker.userId,
      })
    ),
    'For task-proofs the entity id lives in segment 5, not segment 4 (migration 019).'
  );

  await expectFailure(
    STAGE,
    'a task_proof path whose fifth segment is not the activity id is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({
          folder: 'task-proofs',
          entityId: treeId,
          label: 'salah-activity',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Segment 5 must equal entity_id for task-proofs.'
  );

  await expectFailure(
    STAGE,
    'a task_proof path whose task segment is not the parent task is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({
          folder: 'task-proofs',
          entityId: activityId,
          taskIdSegment: treeId,
          label: 'salah-task',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_task_proof_photo reads the task id out of segment 4 and requires ca.care_task_id = it.'
  );

  // entity_type dipersempit jadi tiga oleh migrasi 053. Nilai yang pernah sah
  // di migrasi 020 harus tetap ditolak.
  await expectFailure(
    STAGE,
    'a retired entity_type is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: treeId,
        storagePath: `farms/${farm.id}/growth-phase-records/${treeId}/mati-${runId}.jpg`,
        uploadedBy: owner.userId,
      })
    ),
    'photo_attachments_entity_type_check allows exactly tree_main, condition_record, task_proof.'
  );

  await expectFailure(
    STAGE,
    'a file larger than 5 MiB is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'kebesaran' }),
        uploadedBy: owner.userId,
        overrides: { file_size: MAX_PHOTO_SIZE_BYTES + 1 },
      })
    ),
    'photo_attachments_file_size_check caps file_size at 5242880.'
  );

  await expectFailure(
    STAGE,
    'an empty file is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'kosong' }),
        uploadedBy: owner.userId,
        overrides: { file_size: 0 },
      })
    ),
    'photo_attachments_file_size_check also requires file_size > 0.'
  );

  await expectFailure(
    STAGE,
    'a non-image mime type is rejected',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'bukan-gambar' }),
        uploadedBy: owner.userId,
        overrides: { file_name: 'dokumen.pdf', mime_type: 'application/pdf' },
      })
    ),
    "photo_attachments_mime_type_check requires mime_type like 'image/%'."
  );

  // Batas atasnya inklusif. Tanpa asersi ini, mengubah `<=` jadi `<` tidak akan
  // ketahuan -- dan aplikasi memang menyasar tepat di bawah batas itu.
  const boundaryPhoto = await expectSuccess(
    STAGE,
    'a file of exactly 5 MiB is accepted',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'batas' }),
        uploadedBy: owner.userId,
        overrides: { file_size: MAX_PHOTO_SIZE_BYTES },
      })
    ),
    'photo_attachments_file_size_check is inclusive at 5242880.'
  );

  await assertDeleteAllowed(
    'the boundary row is cleaned up',
    owner.client,
    boundaryPhoto.id,
    'Owner delete branch.'
  );

  // ================================================================
  // 8. storage.objects -- tiga policy sisanya
  // ================================================================
  //
  // Bagian ini menyentuh Storage sungguhan, bukan tabel. Tanpa itu separuh
  // policy foto tidak teruji sama sekali: yang di photo_attachments menjaga
  // metadata, yang di storage.objects menjaga berkasnya, dan keduanya bisa
  // melenceng sendiri-sendiri.
  //
  // Muatannya empat bita dan setiap objek dibersihkan di akhir bagian ini.

  const storageTreePath = `farms/${farm.id}/trees/${treeId}/main/objek-${runId}.jpg`;
  const storageConditionPath =
    `farms/${farm.id}/condition-reports/${conditionRecordId}/objek-${runId}.jpg`;

  function uploadObject(client, path) {
    return client.storage
      .from(BUCKET)
      .upload(path, TINY_JPEG, { contentType: 'image/jpeg', upsert: false });
  }

  await expectFailure(
    STAGE,
    'a non-member cannot upload an object into the bucket',
    uploadObject(outsider.client, storageTreePath),
    'The storage insert policy is farm-scoped through avology_storage_path_farm_id(name).'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot upload an object into the bucket',
    uploadObject(pending.client, storageTreePath),
    'Storage insert branches all resolve through the is_active_* helpers.'
  );

  await expectFailure(
    STAGE,
    'a worker cannot upload a tree main object',
    uploadObject(worker.client, storageTreePath),
    "The trees branch of the storage insert policy requires is_active_owner and segment 5 = 'main'."
  );

  await expectSuccess(
    STAGE,
    'the owner uploads a tree main object',
    uploadObject(owner.client, storageTreePath),
    "Owner + folder 'trees' + segment 5 'main' is the only accepted shape."
  );

  await expectSuccess(
    STAGE,
    'another active member can download the tree main object',
    mate.client.storage.from(BUCKET).download(storageTreePath),
    "The storage read policy opens folder 'trees' to every active farm member."
  );

  await expectFailure(
    STAGE,
    'the owner of another farm cannot download the tree main object',
    ownerB.client.storage.from(BUCKET).download(storageTreePath),
    'Storage reads are farm-scoped.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot download the tree main object',
    outsider.client.storage.from(BUCKET).download(storageTreePath),
    'Storage reads are farm-scoped.'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot download the tree main object',
    pending.client.storage.from(BUCKET).download(storageTreePath),
    'Storage reads require an ACTIVE membership, not merely a farm_members row.'
  );

  await expectFailure(
    STAGE,
    'an anonymous client cannot download the tree main object',
    anonClient.storage.from(BUCKET).download(storageTreePath),
    'Anonymous access must never reach stored objects.'
  );

  // storage.remove yang ditolak TIDAK melempar galat -- ia mengembalikan daftar
  // kosong. Sama seperti DELETE di tabel, penolakannya diperiksa lewat isi
  // daftarnya, lalu dipastikan objeknya memang masih bisa diunduh.
  const blockedRemoval = await expectSuccess(
    STAGE,
    'a worker removal attempt on the tree main object returns without error',
    worker.client.storage.from(BUCKET).remove([storageTreePath]),
    'Supabase reports success even when the policy removed nothing.'
  );
  assertEqual(
    STAGE,
    'the worker removal actually removed nothing',
    blockedRemoval?.length ?? 0,
    0,
    'Only an active owner may delete a trees object that has no attachment row.'
  );
  await expectSuccess(
    STAGE,
    'the tree main object survived the blocked removal',
    owner.client.storage.from(BUCKET).download(storageTreePath),
    'A blocked removal must leave the object in place.'
  );

  await expectFailure(
    STAGE,
    'a member who is not the reporter cannot upload a condition-reports object',
    uploadObject(mate.client, storageConditionPath),
    'The storage insert policy calls can_upload_condition_record_photo, which pins reported_by.'
  );

  await expectSuccess(
    STAGE,
    'the reporting worker uploads a condition-reports object',
    uploadObject(worker.client, storageConditionPath),
    'The reporter satisfies can_upload_condition_record_photo.'
  );

  // Pembersihan, sekaligus asersi terakhir untuk policy hapus di storage.
  const removedByReporter = await expectSuccess(
    STAGE,
    'the reporting worker removes their own condition-reports object',
    worker.client.storage.from(BUCKET).remove([storageConditionPath]),
    'With no attachment row present, the third delete branch applies to the reporter.'
  );
  assertEqual(
    STAGE,
    'the reporter removal actually removed the object',
    removedByReporter?.length ?? 0,
    1,
    'The third branch of the storage delete policy should cover condition-reports.'
  );

  const removedByOwner = await expectSuccess(
    STAGE,
    'the owner removes the tree main object',
    owner.client.storage.from(BUCKET).remove([storageTreePath]),
    'is_active_owner is the first branch of the storage delete policy.'
  );
  assertEqual(
    STAGE,
    'the owner removal actually removed the object',
    removedByOwner?.length ?? 0,
    1,
    'The owner branch must be able to clean up any object in their farm.'
  );

  // ================================================================
  // 9. planting_id -- foto terikat siklus tanam (migrasi 059)
  // ================================================================
  //
  // Yang diuji di sini adalah SISI DATABASE-nya: trigger
  // set_photo_attachment_planting menurunkan nilainya sendiri, dan penyaringan
  // per siklus jadi mungkin karena nilai itu benar. Penyaringan tampilannya
  // sendiri hidup di klien (isPhotoVisibleInCycle di src/utils/treeCycle.ts) dan
  // tidak bisa dijangkau dari lapisan ini.
  //
  // Seluruh baris foto dari bagian 1-8 sudah terhapus, jadi bagian ini mulai
  // dari keadaan bersih.

  async function readPlantingId(photoId) {
    const row = await expectSuccess(
      STAGE,
      `read planting_id of ${photoId.slice(0, 8)}`,
      owner.client.from('photo_attachments').select('planting_id').eq('id', photoId).single(),
      'Owner can read any photo row in their own farm.'
    );

    return row.planting_id;
  }

  const cycleOne = await expectSuccess(
    STAGE,
    'the active planting cycle of the tree is readable',
    owner.client
      .from('tree_plantings')
      .select('id, cycle_no')
      .eq('tree_id', treeId)
      .is('ended_at', null)
      .single(),
    'tree_plantings_one_active_per_tree guarantees at most one active cycle.'
  );

  const cycleOnePhoto = await expectSuccess(
    STAGE,
    'the owner uploads a tree_main photo during cycle 1',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'siklus1' }),
        uploadedBy: owner.userId,
      })
    ),
    'Nothing about migration 059 may change who is allowed to upload.'
  );

  assertEqual(
    STAGE,
    'a tree_main photo is stamped with the active cycle',
    await readPlantingId(cycleOnePhoto.id),
    cycleOne.id,
    'The trigger derives planting_id from the tree active cycle.'
  );

  const conditionCyclePhoto = await expectSuccess(
    STAGE,
    'the reporter uploads a condition photo during cycle 1',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'siklus1',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Condition uploads still require the reporter.'
  );

  assertEqual(
    STAGE,
    'a condition photo is stamped with the cycle of its record',
    await readPlantingId(conditionCyclePhoto.id),
    cycleOne.id,
    'The reference time is the record created_at, resolved to the cycle in force then.'
  );

  // task_proof SELALU null: satu aktivitas bisa menyentuh banyak pohon di banyak
  // posisi sekaligus (care_activity_trees), jadi satu siklus tidak pernah bisa
  // mewakilinya.
  const proofCyclePhoto = await expectSuccess(
    STAGE,
    'the worker uploads a task_proof photo',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'siklus1' }),
        uploadedBy: worker.userId,
      })
    ),
    'task_proof uploads are unchanged by migration 059.'
  );

  assertEqual(
    STAGE,
    'a task_proof photo is never stamped with a cycle',
    await readPlantingId(proofCyclePhoto.id),
    null,
    'One activity can touch many trees; a single planting_id would be wrong for all but one.'
  );

  // Baris ber-planting_id NULL WAJIB tetap terbaca. NULL berarti "siklus tidak
  // diketahui", bukan "milik siklus lain" -- kalau ia disaring, foto lama yang
  // tidak bisa ditentukan siklusnya akan lenyap dari layar pemilik.
  await assertVisible(
    'a photo whose planting_id is NULL is still readable',
    owner.client,
    proofCyclePhoto.id,
    'NULL must never make a row invisible.'
  );

  // Klien TIDAK boleh bisa menentukan nilainya. Policy INSERT tidak memeriksa
  // planting_id dan sengaja tidak diubah, jadi trigger-lah yang menutup celah
  // itu dengan cara menimpa apa pun yang dikirim.
  // Posisi kedua, juga diturunkan dari grid. findFreeTreePosition membaca ulang
  // pohon yang sudah ada, jadi ia tidak akan mengembalikan posisi yang sudah
  // dipakai pohon pertama stage ini.
  const otherPosition = await findFreeTreePosition(STAGE, owner.client, farm.id);

  const otherTreeId = await expectSuccess(
    STAGE,
    'owner creates a second position to borrow a foreign cycle id from',
    owner.client.rpc('create_tree_with_planting', {
      p_farm_id: farm.id,
      p_row_position: otherPosition.rowPosition,
      p_column_position: otherPosition.columnPosition,
      p_variety: 'Alpukat Lain',
      p_planted_at: todayIso(),
    }),
    'Check create_tree_with_planting(uuid, smallint, text, text, date).'
  );
  const otherCycle = await expectSuccess(
    STAGE,
    'the second position has its own cycle',
    owner.client
      .from('tree_plantings')
      .select('id')
      .eq('tree_id', otherTreeId)
      .is('ended_at', null)
      .single(),
    'create_tree_with_planting always opens cycle 1.'
  );

  const spoofedPhoto = await expectSuccess(
    STAGE,
    'the owner uploads a tree_main photo while sending a foreign planting_id',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: otherTreeId,
        storagePath: photoPath({ folder: 'trees', entityId: otherTreeId, label: 'palsu' }),
        uploadedBy: owner.userId,
        overrides: { planting_id: cycleOne.id },
      })
    ),
    'The insert itself must still succeed; only the supplied value is discarded.'
  );

  assertEqual(
    STAGE,
    'a client supplied planting_id is overwritten, never trusted',
    await readPlantingId(spoofedPhoto.id),
    otherCycle.id,
    'The trigger always derives the value; a client cannot pin a photo to a foreign cycle.'
  );

  // Foto yang tidak punya satu pun siklus memenuhi syarat dibiarkan NULL, BUKAN
  // dipasangkan ke siklus terdekat. Dibuat dengan created_at yang mendahului
  // kelahiran pohonnya.
  const orphanPhoto = await expectSuccess(
    STAGE,
    'a photo timestamped before any cycle existed is accepted',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'yatim' }),
        uploadedBy: owner.userId,
        overrides: { created_at: '2020-01-01T00:00:00.000Z' },
      })
    ),
    'Nothing constrains created_at; the row must still be accepted.'
  );

  assertEqual(
    STAGE,
    'a photo with no qualifying cycle is left NULL, not guessed',
    await readPlantingId(orphanPhoto.id),
    null,
    'The rule never falls back to the nearest cycle -- unknown stays unknown.'
  );

  // ---------- Tanam ulang: inti dari cacat yang diperbaiki ----------

  await expectSuccess(
    STAGE,
    'the owner closes cycle 1',
    owner.client.rpc('end_tree_planting', {
      p_tree_id: treeId,
      p_end_reason: 'mati',
      p_ended_at: todayIso(),
    }),
    'Check end_tree_planting(uuid, text, date).'
  );

  const cycleTwoId = await expectSuccess(
    STAGE,
    'the owner replants the position as cycle 2',
    owner.client.rpc('start_tree_planting', {
      p_tree_id: treeId,
      p_variety: 'Alpukat Miki',
      p_planted_at: todayIso(),
    }),
    'Check start_tree_planting(uuid, text, date).'
  );

  assertEqual(
    STAGE,
    'the cycle 1 photo keeps pointing at cycle 1 after replanting',
    await readPlantingId(cycleOnePhoto.id),
    cycleOne.id,
    'Replanting must never rewrite the stamp of an existing photo.'
  );

  const cycleTwoPhoto = await expectSuccess(
    STAGE,
    'the owner uploads a tree_main photo during cycle 2',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'tree_main',
        entityId: treeId,
        storagePath: photoPath({ folder: 'trees', entityId: treeId, label: 'siklus2' }),
        uploadedBy: owner.userId,
      })
    ),
    'The position is planted again, so a new main photo is allowed.'
  );

  assertEqual(
    STAGE,
    'the new photo is stamped with cycle 2, not cycle 1',
    await readPlantingId(cycleTwoPhoto.id),
    cycleTwoId,
    'This is the whole point of migration 059.'
  );

  // Inilah bentuk kueri yang dipakai jalur baca: siklus yang sedang dilihat,
  // ATAU tidak diketahui. Foto siklus lampau harus rontok; foto ber-NULL tidak.
  const visibleInCycleTwo = await expectSuccess(
    STAGE,
    'photos visible for cycle 2 are readable',
    owner.client
      .from('photo_attachments')
      .select('id, planting_id')
      .eq('entity_type', 'tree_main')
      .eq('entity_id', treeId)
      .or(`planting_id.eq.${cycleTwoId},planting_id.is.null`),
    'This mirrors isPhotoVisibleInCycle on the client.'
  );

  const visibleIds = (visibleInCycleTwo ?? []).map((row) => row.id).sort();

  assertCondition(
    STAGE,
    'the cycle 1 photo does not surface as a cycle 2 photo',
    !visibleIds.includes(cycleOnePhoto.id),
    'The cycle 1 photo is still visible while viewing cycle 2 -- defect 1 is not fixed.',
    'A known planting_id that differs from the viewed cycle must be filtered out.'
  );

  assertCondition(
    STAGE,
    'the cycle 2 photo and the unknown-cycle photo both survive the filter',
    visibleIds.includes(cycleTwoPhoto.id) && visibleIds.includes(orphanPhoto.id),
    `Expected both ${cycleTwoPhoto.id} and ${orphanPhoto.id}, got ${visibleIds.join(', ')}`,
    'NULL means unknown, not foreign -- those rows must never be hidden.'
  );

  // Foto yang diunggah SESUDAH tanam ulang untuk catatan kondisi LAMA harus
  // tetap jatuh ke siklus 1. Waktu acuannya milik catatannya, bukan milik
  // fotonya -- kalau ini melenceng, foto catatan lama akan menempel ke pohon
  // yang sekarang.
  const lateConditionPhoto = await expectSuccess(
    STAGE,
    'the reporter uploads a photo for the old record after replanting',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'condition_record',
        entityId: conditionRecordId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: conditionRecordId,
          label: 'telat',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Uploading late for an existing record is a supported path (the retry button).'
  );

  assertEqual(
    STAGE,
    'a late upload follows the record cycle, not the current one',
    await readPlantingId(lateConditionPhoto.id),
    cycleOne.id,
    'The reference time is the record created_at, so a late upload cannot drift into cycle 2.'
  );

  // ---------- Pembersihan ----------

  for (const [label, photoId] of [
    ['cycle 1 tree_main', cycleOnePhoto.id],
    ['cycle 1 condition', conditionCyclePhoto.id],
    ['task_proof', proofCyclePhoto.id],
    ['spoofed', spoofedPhoto.id],
    ['unknown-cycle', orphanPhoto.id],
    ['cycle 2 tree_main', cycleTwoPhoto.id],
    ['late condition', lateConditionPhoto.id],
  ]) {
    await assertDeleteAllowed(
      `the owner cleans up the ${label} photo`,
      owner.client,
      photoId,
      'is_active_owner covers every entity type on delete.'
    );
  }

  // ================================================================
  // 10. initiative_care_proof -- foto perawatan inisiatif (migrasi 060)
  // ================================================================
  //
  // Sebelum 060, separuh baris care_activities tidak bisa berfoto sama sekali:
  // can_upload_task_proof_photo menjoin care_tasks lewat ca.care_task_id, yang
  // untuk baris 'inisiatif' NULL, sehingga join-nya kosong dan policy-nya
  // selalu false.
  //
  // DUA HAL YANG PALING PENTING DIKUNCI DI SINI:
  //
  //   1. PATOKANNYA is_active_farm_member, BUKAN is_active_worker. Pemilik juga
  //      boleh mencatat perawatan inisiatif (policy 027), jadi ia harus bisa
  //      mengunggah foto untuk catatannya SENDIRI. Ini satu-satunya tempat
  //      aturan itu diuji; kalau seseorang kelak menyalin bentuk task_proof
  //      apa adanya, pemiliknya terkunci keluar dari fotonya sendiri dan tidak
  //      ada asersi lain yang akan berbunyi.
  //
  //   2. BACANYA TETAP SEMPIT. `mate` anggota aktif yang sah dan tetap tidak
  //      boleh membacanya -- sama seperti task_proof. Kalau cabang baru ini
  //      diam-diam memakai bentuk can_access_condition_record_photo (yang
  //      membuka ke SELURUH anggota aktif), asersi itulah yang menangkapnya.
  //
  // Pohonnya sengaja pohon KETIGA, bukan `treeId`: bagian 9 sudah menutup
  // siklus 1 pohon itu dan menanamnya ulang, dan bagian ini butuh posisi yang
  // siklusnya lurus supaya asersi planting_id-nya membaca satu hal saja.

  const carePosition = await findFreeTreePosition(STAGE, owner.client, farm.id);

  const careTreeId = await expectSuccess(
    STAGE,
    'owner creates a third position for the initiative care fixtures',
    owner.client.rpc('create_tree_with_planting', {
      p_farm_id: farm.id,
      p_row_position: carePosition.rowPosition,
      p_column_position: carePosition.columnPosition,
      p_variety: 'Alpukat Inisiatif',
      p_planted_at: todayIso(),
    }),
    'Check create_tree_with_planting(uuid, smallint, text, text, date).'
  );

  const careCycle = await expectSuccess(
    STAGE,
    'the third position has its own active cycle',
    owner.client
      .from('tree_plantings')
      .select('id')
      .eq('tree_id', careTreeId)
      .is('ended_at', null)
      .single(),
    'create_tree_with_planting always opens cycle 1.'
  );

  // Dicatat PEKERJA. Aktivitas inisiatif tidak punya tugas induk, jadi
  // care_task_id-nya NULL -- itu justru bentuk yang sedang diuji.
  const workerCareActivityId = await expectSuccess(
    STAGE,
    'the worker records an initiative care activity for one tree',
    worker.client.rpc('create_care_activity', {
      p_farm_id: farm.id,
      p_category: 'watering',
      p_tree_ids: [careTreeId],
      p_note: `Inisiatif pekerja ${runId}`,
      p_produk: null,
      p_performed_at: null,
    }),
    'Check create_care_activity(uuid, care_category, uuid[], text, text, timestamptz) from migration 027.'
  );

  // Dicatat PEMILIK. Inilah asersi yang membedakan is_active_farm_member dari
  // is_active_worker.
  const ownerCareActivityId = await expectSuccess(
    STAGE,
    'the owner records an initiative care activity of their own',
    owner.client.rpc('create_care_activity', {
      p_farm_id: farm.id,
      p_category: 'fertilizing',
      p_tree_ids: [careTreeId],
      p_note: `Inisiatif owner ${runId}`,
      p_produk: null,
      p_performed_at: null,
    }),
    'Policy "Active members can insert initiative activities" (027) uses is_active_farm_member, so owners may record too.'
  );

  // Menaut DUA pohon. Dari antarmuka hari ini tidak mungkin, tapi RPC-nya
  // menerima uuid[] berkardinalitas N dan layar multi-pohon disebut di komentar
  // 027 sebagai rencana. Baris inilah yang membuktikan trigger 060 MENGHITUNG
  // tautannya, bukan mengasumsikan selalu satu.
  const multiTreeCareActivityId = await expectSuccess(
    STAGE,
    'the worker records an initiative care activity spanning two trees',
    worker.client.rpc('create_care_activity', {
      p_farm_id: farm.id,
      p_category: 'weeding',
      p_tree_ids: [careTreeId, otherTreeId],
      p_note: `Inisiatif dua pohon ${runId}`,
      p_produk: null,
      p_performed_at: null,
    }),
    'create_care_activity accepts many trees through care_activity_trees.'
  );

  // ---------- 10.1 Yang berhak unggah, berhasil ----------

  const careProofPhoto = await expectSuccess(
    STAGE,
    'the recording worker uploads a photo for their own initiative care activity',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_initiative_care_proof_photo requires ca.performed_by = auth.uid().'
  );

  const ownerCareProofPhoto = await expectSuccess(
    STAGE,
    'the owner uploads a photo for the activity THEY recorded',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: ownerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: ownerCareActivityId,
          label: 'inisiatif-owner',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'THE point of is_active_farm_member: an owner who recorded the activity may upload its photo.'
  );

  // ---------- 10.2 Yang tidak berhak unggah, ditolak ----------

  await expectFailure(
    STAGE,
    'another active member cannot upload a photo for an initiative activity that is not theirs',
    insertPhoto(
      mate.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif-mate',
        }),
        uploadedBy: mate.userId,
      })
    ),
    'Being an active member is not enough; can_upload_initiative_care_proof_photo pins performed_by.'
  );

  // Pemilik boleh mengunggah untuk catatannya sendiri (10.1) tapi TIDAK atas
  // nama pekerjanya. Kedua asersi ini harus dibaca berpasangan -- yang satu
  // tanpa yang lain akan salah dimengerti sebagai "owner boleh apa saja" atau
  // "owner tidak boleh apa-apa".
  await expectFailure(
    STAGE,
    'the owner cannot upload a photo for the worker initiative activity',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif-owner-curi',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'There is no owner branch on upload; only the recorder may attach the photo.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot upload an initiative_care_proof photo',
    insertPhoto(
      outsider.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif-outsider',
        }),
        uploadedBy: outsider.userId,
      })
    ),
    'Non-members satisfy no branch of the insert policy.'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot upload an initiative_care_proof photo',
    insertPhoto(
      pending.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif-pending',
        }),
        uploadedBy: pending.userId,
      })
    ),
    'is_active_farm_member filters on status = active; a pending row must not qualify.'
  );

  // ---------- 10.3 Baca ----------

  await assertVisible(
    'the owner reads the worker initiative care photo',
    owner.client,
    careProofPhoto.id,
    'can_access_initiative_care_proof_photo has an explicit is_active_owner branch.'
  );

  await assertVisible(
    'the recording worker reads their own initiative care photo',
    worker.client,
    careProofPhoto.id,
    'The recorder branch of the read rule applies.'
  );

  // PERHATIAN, ini BUKAN kebocoran dan bukan kesalahan tes -- sama persis
  // seperti asersi task_proof di bagian 3. Bukti kerja inisiatif TIDAK terbuka
  // ke seluruh anggota aktif; cabangnya cuma dua, owner aktif atau pencatatnya.
  await assertHidden(
    'another active member cannot read the initiative care photo',
    mate.client,
    careProofPhoto.id,
    'initiative_care_proof read is owner + recorder only, by design -- do not widen it to any active member.'
  );

  await assertHidden(
    'the recording worker cannot read the owner initiative care photo',
    worker.client,
    ownerCareProofPhoto.id,
    'The recorder branch is per-activity; recording one activity grants nothing on another.'
  );

  await assertHidden(
    'a pending applicant cannot read the initiative care photo',
    pending.client,
    careProofPhoto.id,
    'A pending farm_members row is not an active membership.'
  );

  await assertHidden(
    'the owner of another farm cannot read the initiative care photo',
    ownerB.client,
    careProofPhoto.id,
    'Every read branch is farm-scoped.'
  );

  await assertHidden(
    'a non-member cannot read the initiative care photo',
    outsider.client,
    careProofPhoto.id,
    'Non-members satisfy no read branch.'
  );

  // ---------- 10.4 CHECK constraint pada bentuk path ----------
  //
  // Cabang task-proofs punya LIMA segmen dengan id tugas di segmen keempat.
  // Aktivitas inisiatif tidak punya id tugas, dan asersi berikutnya adalah
  // alasan seluruh entity_type ini ada: bentuk path itu TIDAK BISA dipakai
  // ulang tanpa mengarang isi segmen keempat.

  await expectFailure(
    STAGE,
    'an initiative_care_proof stored under the task-proofs folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'task-proofs',
          entityId: workerCareActivityId,
          label: 'salah-folder',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps initiative_care_proof to exactly initiative-care-proofs.'
  );

  await expectFailure(
    STAGE,
    'an initiative_care_proof stored under the condition-reports folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'condition-reports',
          entityId: workerCareActivityId,
          label: 'salah-folder2',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps each entity_type to exactly one folder.'
  );

  await expectFailure(
    STAGE,
    'an initiative_care_proof path whose entity segment is not the activity id is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: careTreeId,
          label: 'salah-entity',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'For initiative-care-proofs the entity id lives in segment 4, like every folder except task-proofs.'
  );

  await expectFailure(
    STAGE,
    'an initiative_care_proof path pointing at another farm is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          farmId: farmB.id,
          label: 'salah-farm',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Both the insert policy and photo_attachments_storage_path_farm_check pin segment 2 to farm_id.'
  );

  // ---------- 10.5 planting_id ----------

  assertEqual(
    STAGE,
    'a single-tree initiative care photo is stamped with the cycle of that tree',
    await readPlantingId(careProofPhoto.id),
    careCycle.id,
    'The trigger resolves the one linked tree and the cycle in force at care_activities.performed_at.'
  );

  // Dua pohon -> NULL. Satu planting_id akan benar untuk satu pohon dan salah
  // untuk sisanya, alasan yang sama persis dengan pengecualian task_proof di
  // 059.
  const multiTreeCarePhoto = await expectSuccess(
    STAGE,
    'the worker uploads a photo for the two-tree initiative activity',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: multiTreeCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: multiTreeCareActivityId,
          label: 'inisiatif-dua-pohon',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Nothing about the tree count may change who is allowed to upload.'
  );

  assertEqual(
    STAGE,
    'an initiative care photo spanning two trees is left NULL, not pinned to one of them',
    await readPlantingId(multiTreeCarePhoto.id),
    null,
    'The trigger counts care_activity_trees; it must never pick one tree out of many.'
  );

  // Klien tetap tidak boleh menentukan nilainya, sama seperti tree_main di
  // bagian 9.
  const spoofedCarePhoto = await expectSuccess(
    STAGE,
    'the worker uploads an initiative care photo while sending a foreign planting_id',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'initiative_care_proof',
        entityId: workerCareActivityId,
        storagePath: photoPath({
          folder: 'initiative-care-proofs',
          entityId: workerCareActivityId,
          label: 'inisiatif-palsu',
        }),
        uploadedBy: worker.userId,
        overrides: { planting_id: otherCycle.id },
      })
    ),
    'The insert itself must still succeed; only the supplied value is discarded.'
  );

  assertEqual(
    STAGE,
    'a client supplied planting_id is overwritten for initiative_care_proof too',
    await readPlantingId(spoofedCarePhoto.id),
    careCycle.id,
    'The trigger always derives the value, for every entity type it stamps.'
  );

  // task_proof TETAP tidak pernah terstempel. Migrasi 060 menambah cabang di
  // fungsi trigger yang sama, jadi asersi ini memastikan cabang lamanya tidak
  // ikut tergeser saat badan fungsinya ditulis ulang.
  const proofStillNullPhoto = await expectSuccess(
    STAGE,
    'the worker uploads another task_proof photo after migration 060',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'pasca-060' }),
        uploadedBy: worker.userId,
      })
    ),
    'task_proof uploads are unchanged by migration 060.'
  );

  assertEqual(
    STAGE,
    'task_proof is still never stamped with a cycle after migration 060',
    await readPlantingId(proofStillNullPhoto.id),
    null,
    'Rewriting the trigger body must not disturb the task_proof branch.'
  );

  // ---------- 10.6 Hapus ----------

  await assertDeleteBlocked(
    'another active member cannot delete the initiative care photo',
    mate.client,
    careProofPhoto.id,
    'The delete policy needs uploaded_by = auth.uid() AND can_upload_initiative_care_proof_photo.'
  );

  await assertDeleteBlocked(
    'a non-member cannot delete the initiative care photo',
    outsider.client,
    careProofPhoto.id,
    'Non-members satisfy no delete branch.'
  );

  await assertDeleteAllowed(
    'the uploader who is also the recorder deletes their own initiative care photo',
    worker.client,
    spoofedCarePhoto.id,
    'Delete allows uploaded_by = auth.uid() together with can_upload_initiative_care_proof_photo.'
  );

  await assertDeleteAllowed(
    'the owner deletes an initiative care photo uploaded by somebody else',
    owner.client,
    careProofPhoto.id,
    'is_active_owner is the first branch of the delete policy and covers every entity type.'
  );

  // ---------- 10.7 storage.objects untuk folder baru ----------
  //
  // Tiga policy storage.objects ikut ditulis ulang oleh 060. Tanpa bagian ini
  // cabang barunya tidak teruji sama sekali, dan metadata bisa dijaga rapat
  // sementara berkasnya terbuka.

  const storageCarePath =
    `farms/${farm.id}/initiative-care-proofs/${workerCareActivityId}/objek-${runId}.jpg`;

  await expectFailure(
    STAGE,
    'a member who is not the recorder cannot upload an initiative-care-proofs object',
    uploadObject(mate.client, storageCarePath),
    'The storage insert policy calls can_upload_initiative_care_proof_photo, which pins performed_by.'
  );

  await expectSuccess(
    STAGE,
    'the recording worker uploads an initiative-care-proofs object',
    uploadObject(worker.client, storageCarePath),
    'The recorder satisfies can_upload_initiative_care_proof_photo.'
  );

  await expectFailure(
    STAGE,
    'another active member cannot download the initiative-care-proofs object',
    mate.client.storage.from(BUCKET).download(storageCarePath),
    'The storage read branch mirrors the table read rule: owner + recorder only.'
  );

  await expectSuccess(
    STAGE,
    'the owner can download the initiative-care-proofs object',
    owner.client.storage.from(BUCKET).download(storageCarePath),
    'is_active_owner is a branch of can_access_initiative_care_proof_photo.'
  );

  const removedCareObject = await expectSuccess(
    STAGE,
    'the owner removes the initiative-care-proofs object',
    owner.client.storage.from(BUCKET).remove([storageCarePath]),
    'is_active_owner is the first branch of the storage delete policy.'
  );
  assertEqual(
    STAGE,
    'the owner removal actually removed the initiative-care-proofs object',
    removedCareObject?.length ?? 0,
    1,
    'The owner branch must be able to clean up any object in their farm.'
  );

  // ================================================================
  // 11. growth_phase_record & harvest_record -- foto fase & panen (migrasi 061)
  // ================================================================
  //
  // Migrasi 020 dulu sudah membangun keduanya; 031 membuangnya karena Iterasi A
  // dipangkas. 061 memasangnya kembali dari cetak biru yang sama.
  //
  // YANG PALING PENTING DIKUNCI DI SINI, dan bacalah berpasangan dengan
  // bagian 10 -- kedua bagian ini SENGAJA berlawanan pada satu titik:
  //
  //   1. BACANYA LONGGAR, dan itu memang benar. `mate` anggota aktif yang
  //      bukan pencatat, dan ia HARUS bisa membaca foto fase & panen -- beda
  //      dari task_proof dan initiative_care_proof yang mengunci `mate` keluar.
  //      Fase dan panen adalah catatan KEBUN, bukan bukti kerja seseorang, dan
  //      catatannya sendiri sudah terbuka ke seluruh anggota aktif lewat policy
  //      tabelnya. Kalau seseorang kelak menyalin bentuk task_proof ke sini,
  //      asersi assertVisible untuk `mate`-lah yang akan berbunyi.
  //
  //   2. UNGGAHNYA TETAP SEMPIT. Longgar di baca tidak berarti longgar di
  //      tulis: hanya pencatatnya sendiri yang boleh melampirkan foto, dan
  //      PEMILIK PUN TIDAK BOLEH atas nama pekerjanya. Setiap "boleh membaca"
  //      di bawah berpasangan dengan "tidak boleh mengunggah" dari pelaku yang
  //      sama.
  //
  //   3. PATOKANNYA is_active_farm_member, BUKAN is_active_worker. Kedua
  //      catatan ini boleh dibuat pemilik (policy INSERT tabelnya memakai
  //      is_active_farm_member), jadi pemilik harus bisa mengunggah foto untuk
  //      catatannya SENDIRI.
  //
  // Pohonnya memakai kembali careTreeId dari bagian 10: siklusnya lurus (tidak
  // pernah ditanam ulang seperti treeId di bagian 9), jadi asersi planting_id
  // di bawah membaca satu hal saja. Catatannya sendiri baru dan terpisah dari
  // aktivitas perawatan bagian 10.

  // ---------- Bahan uji ----------
  //
  // Ditulis lewat INSERT langsung, BUKAN RPC -- itu memang jalur tulis kedua
  // tabel ini (lihat createGrowthPhaseRecord / createHarvestRecord), dan
  // policy INSERT-nya yang memaku recorded_by / harvested_by ke auth.uid().

  const workerPhaseRecord = await expectSuccess(
    STAGE,
    'the worker records a growth phase entry as its recorder',
    worker.client
      .from('growth_phase_records')
      .insert({
        farm_id: farm.id,
        tree_id: careTreeId,
        recorded_by: worker.userId,
        phase: 'vegetative',
        note: `Fase pekerja ${runId}`,
      })
      .select('id')
      .single(),
    'Policy "Active members can insert growth phase records" (007:335) pins recorded_by = auth.uid().'
  );
  const workerPhaseRecordId = workerPhaseRecord.id;

  // Dicatat PEMILIK. Inilah asersi yang membedakan is_active_farm_member dari
  // is_active_worker untuk fase.
  const ownerPhaseRecord = await expectSuccess(
    STAGE,
    'the owner records a growth phase entry of their own',
    owner.client
      .from('growth_phase_records')
      .insert({
        farm_id: farm.id,
        tree_id: careTreeId,
        recorded_by: owner.userId,
        phase: 'flowering',
        note: `Fase owner ${runId}`,
      })
      .select('id')
      .single(),
    'The insert policy uses is_active_farm_member, so owners may record growth phases too.'
  );
  const ownerPhaseRecordId = ownerPhaseRecord.id;

  const workerHarvestRecord = await expectSuccess(
    STAGE,
    'the worker records a harvest entry as its recorder',
    worker.client
      .from('harvest_records')
      .insert({
        farm_id: farm.id,
        tree_id: careTreeId,
        harvested_by: worker.userId,
        fruit_count: 12,
        note: `Panen pekerja ${runId}`,
      })
      .select('id')
      .single(),
    'Policy "Active members can insert harvest records" (020:261) pins harvested_by = auth.uid().'
  );
  const workerHarvestRecordId = workerHarvestRecord.id;

  const ownerHarvestRecord = await expectSuccess(
    STAGE,
    'the owner records a harvest entry of their own',
    owner.client
      .from('harvest_records')
      .insert({
        farm_id: farm.id,
        tree_id: careTreeId,
        harvested_by: owner.userId,
        fruit_count: 7,
        note: `Panen owner ${runId}`,
      })
      .select('id')
      .single(),
    'The insert policy uses is_active_farm_member, so owners may record harvests too.'
  );
  const ownerHarvestRecordId = ownerHarvestRecord.id;

  // ---------- 11.1 Yang berhak unggah, berhasil ----------

  const phasePhoto = await expectSuccess(
    STAGE,
    'the recording worker uploads a photo for their own growth phase record',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_growth_phase_record_photo requires gpr.recorded_by = auth.uid().'
  );

  const ownerPhasePhoto = await expectSuccess(
    STAGE,
    'the owner uploads a photo for the growth phase record THEY recorded',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: ownerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: ownerPhaseRecordId,
          label: 'fase-owner',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'THE point of is_active_farm_member: an owner who recorded the entry may upload its photo.'
  );

  const harvestPhoto = await expectSuccess(
    STAGE,
    'the recording worker uploads a photo for their own harvest record',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'can_upload_harvest_record_photo requires hr.harvested_by = auth.uid().'
  );

  const ownerHarvestPhoto = await expectSuccess(
    STAGE,
    'the owner uploads a photo for the harvest record THEY recorded',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: ownerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: ownerHarvestRecordId,
          label: 'panen-owner',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'THE point of is_active_farm_member: an owner who recorded the harvest may upload its photo.'
  );

  // ---------- 11.2 Yang tidak berhak unggah, ditolak ----------
  //
  // Baca berpasangan dengan 11.3: pelaku yang sama boleh MEMBACA foto ini dan
  // tetap tidak boleh MENGUNGGAHNYA. Yang satu tanpa yang lain akan salah
  // dimengerti.

  await expectFailure(
    STAGE,
    'another active member cannot upload a photo for a growth phase record that is not theirs',
    insertPhoto(
      mate.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase-mate',
        }),
        uploadedBy: mate.userId,
      })
    ),
    'Being an active member is enough to READ but never to upload; can_upload_growth_phase_record_photo pins recorded_by.'
  );

  await expectFailure(
    STAGE,
    'the owner cannot upload a photo for the worker growth phase record',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase-owner-curi',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'There is no owner branch on upload; only the recorder may attach the photo.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot upload a growth_phase_record photo',
    insertPhoto(
      outsider.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase-outsider',
        }),
        uploadedBy: outsider.userId,
      })
    ),
    'Non-members satisfy no branch of the insert policy.'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot upload a growth_phase_record photo',
    insertPhoto(
      pending.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase-pending',
        }),
        uploadedBy: pending.userId,
      })
    ),
    'is_active_farm_member filters on status = active; a pending row must not qualify.'
  );

  await expectFailure(
    STAGE,
    'another active member cannot upload a photo for a harvest record that is not theirs',
    insertPhoto(
      mate.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen-mate',
        }),
        uploadedBy: mate.userId,
      })
    ),
    'Being an active member is enough to READ but never to upload; can_upload_harvest_record_photo pins harvested_by.'
  );

  await expectFailure(
    STAGE,
    'the owner cannot upload a photo for the worker harvest record',
    insertPhoto(
      owner.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen-owner-curi',
        }),
        uploadedBy: owner.userId,
      })
    ),
    'There is no owner branch on upload; only the recorder may attach the photo.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot upload a harvest_record photo',
    insertPhoto(
      outsider.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen-outsider',
        }),
        uploadedBy: outsider.userId,
      })
    ),
    'Non-members satisfy no branch of the insert policy.'
  );

  await expectFailure(
    STAGE,
    'a pending applicant cannot upload a harvest_record photo',
    insertPhoto(
      pending.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen-pending',
        }),
        uploadedBy: pending.userId,
      })
    ),
    'is_active_farm_member filters on status = active; a pending row must not qualify.'
  );

  // ---------- 11.3 Baca ----------
  //
  // INI YANG MEMBEDAKAN 061 DARI 060. Dua asersi pertama SENGAJA assertVisible
  // untuk `mate` -- kalau salah satunya kelak jadi assertHidden, seseorang
  // sudah menyempitkan can_access_*_record_photo ke bentuk task_proof.

  await assertVisible(
    'another active member reads the growth phase photo',
    mate.client,
    phasePhoto.id,
    'can_access_growth_phase_record_photo opens to every active farm member, like condition_record -- do not narrow it to the recorder.'
  );

  await assertVisible(
    'another active member reads the harvest photo',
    mate.client,
    harvestPhoto.id,
    'can_access_harvest_record_photo opens to every active farm member, like condition_record -- do not narrow it to the recorder.'
  );

  await assertVisible(
    'the owner reads the worker growth phase photo',
    owner.client,
    phasePhoto.id,
    'The owner is an active farm member.'
  );

  await assertVisible(
    'the owner reads the worker harvest photo',
    owner.client,
    harvestPhoto.id,
    'The owner is an active farm member.'
  );

  await assertVisible(
    'the recording worker reads the owner growth phase photo',
    worker.client,
    ownerPhasePhoto.id,
    'Reading is per-farm, not per-record; every active member sees every farm record photo.'
  );

  await assertHidden(
    'a pending applicant cannot read the growth phase photo',
    pending.client,
    phasePhoto.id,
    'A pending farm_members row is not an active membership.'
  );

  await assertHidden(
    'a pending applicant cannot read the harvest photo',
    pending.client,
    harvestPhoto.id,
    'A pending farm_members row is not an active membership.'
  );

  await assertHidden(
    'the owner of another farm cannot read the growth phase photo',
    ownerB.client,
    phasePhoto.id,
    'Every read branch is farm-scoped.'
  );

  await assertHidden(
    'the owner of another farm cannot read the harvest photo',
    ownerB.client,
    harvestPhoto.id,
    'Every read branch is farm-scoped.'
  );

  await assertHidden(
    'a non-member cannot read the growth phase photo',
    outsider.client,
    phasePhoto.id,
    'Non-members satisfy no read branch.'
  );

  await assertHidden(
    'a non-member cannot read the harvest photo',
    outsider.client,
    harvestPhoto.id,
    'Non-members satisfy no read branch.'
  );

  // ---------- 11.4 CHECK constraint pada bentuk path ----------
  //
  // Kedua folder ini EMPAT segmen dan memakai cabang generik
  // avology_storage_path_entity_id. Asersi pertama tiap pasangan menutup
  // godaan menyimpannya di bawah task-proofs, yang segmen keempatnya id tugas
  // dan tidak akan pernah cocok.

  await expectFailure(
    STAGE,
    'a growth_phase_record stored under the task-proofs folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'task-proofs',
          entityId: workerPhaseRecordId,
          label: 'fase-salah-folder',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps growth_phase_record to exactly growth-phase-records.'
  );

  await expectFailure(
    STAGE,
    'a growth_phase_record stored under the harvest-records folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerPhaseRecordId,
          label: 'fase-salah-folder2',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'The two new folders must not be interchangeable with each other.'
  );

  await expectFailure(
    STAGE,
    'a growth_phase_record path whose entity segment is not the record id is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: careTreeId,
          label: 'fase-salah-entity',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'For growth-phase-records the entity id lives in segment 4, like every folder except task-proofs.'
  );

  await expectFailure(
    STAGE,
    'a growth_phase_record path pointing at another farm is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          farmId: farmB.id,
          label: 'fase-salah-farm',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Both the insert policy and photo_attachments_storage_path_farm_check pin segment 2 to farm_id.'
  );

  await expectFailure(
    STAGE,
    'a harvest_record stored under the task-proofs folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'task-proofs',
          entityId: workerHarvestRecordId,
          label: 'panen-salah-folder',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'photo_attachments_storage_path_entity_folder_check maps harvest_record to exactly harvest-records.'
  );

  await expectFailure(
    STAGE,
    'a harvest_record stored under the growth-phase-records folder is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerHarvestRecordId,
          label: 'panen-salah-folder2',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'The two new folders must not be interchangeable with each other.'
  );

  await expectFailure(
    STAGE,
    'a harvest_record path whose entity segment is not the record id is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: careTreeId,
          label: 'panen-salah-entity',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'For harvest-records the entity id lives in segment 4, like every folder except task-proofs.'
  );

  await expectFailure(
    STAGE,
    'a harvest_record path pointing at another farm is rejected',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          farmId: farmB.id,
          label: 'panen-salah-farm',
        }),
        uploadedBy: worker.userId,
      })
    ),
    'Both the insert policy and photo_attachments_storage_path_farm_check pin segment 2 to farm_id.'
  );

  // ---------- 11.5 planting_id ----------
  //
  // Kedua tabel terikat SATU pohon lewat kolom tree_id NOT NULL, jadi tidak ada
  // kasus "banyak pohon -> NULL" seperti pada task_proof dan
  // initiative_care_proof. Keduanya SELALU terstempel.

  assertEqual(
    STAGE,
    'a growth phase photo is stamped with the cycle of its record tree',
    await readPlantingId(phasePhoto.id),
    careCycle.id,
    'The reference time is growth_phase_records.created_at, resolved to the cycle in force then.'
  );

  assertEqual(
    STAGE,
    'a harvest photo is stamped with the cycle of its record tree',
    await readPlantingId(harvestPhoto.id),
    careCycle.id,
    'The reference time is harvest_records.created_at, resolved to the cycle in force then.'
  );

  // Klien tetap tidak boleh menentukan nilainya, sama seperti tree_main di
  // bagian 9 dan initiative_care_proof di bagian 10.
  const spoofedPhasePhoto = await expectSuccess(
    STAGE,
    'the worker uploads a growth phase photo while sending a foreign planting_id',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'growth_phase_record',
        entityId: workerPhaseRecordId,
        storagePath: photoPath({
          folder: 'growth-phase-records',
          entityId: workerPhaseRecordId,
          label: 'fase-palsu',
        }),
        uploadedBy: worker.userId,
        overrides: { planting_id: otherCycle.id },
      })
    ),
    'The insert itself must still succeed; only the supplied value is discarded.'
  );

  assertEqual(
    STAGE,
    'a client supplied planting_id is overwritten for growth_phase_record too',
    await readPlantingId(spoofedPhasePhoto.id),
    careCycle.id,
    'The trigger always derives the value, for every entity type it stamps.'
  );

  const spoofedHarvestPhoto = await expectSuccess(
    STAGE,
    'the worker uploads a harvest photo while sending a foreign planting_id',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'harvest_record',
        entityId: workerHarvestRecordId,
        storagePath: photoPath({
          folder: 'harvest-records',
          entityId: workerHarvestRecordId,
          label: 'panen-palsu',
        }),
        uploadedBy: worker.userId,
        overrides: { planting_id: otherCycle.id },
      })
    ),
    'The insert itself must still succeed; only the supplied value is discarded.'
  );

  assertEqual(
    STAGE,
    'a client supplied planting_id is overwritten for harvest_record too',
    await readPlantingId(spoofedHarvestPhoto.id),
    careCycle.id,
    'The trigger always derives the value, for every entity type it stamps.'
  );

  // task_proof TETAP tidak pernah terstempel. Migrasi 061 menulis ulang badan
  // fungsi trigger yang sama untuk ketiga kalinya, jadi asersi ini memastikan
  // cabang lamanya tidak ikut tergeser.
  const proofStillNullAfter061 = await expectSuccess(
    STAGE,
    'the worker uploads another task_proof photo after migration 061',
    insertPhoto(
      worker.client,
      photoRow({
        entityType: 'task_proof',
        entityId: activityId,
        storagePath: photoPath({ folder: 'task-proofs', entityId: activityId, label: 'pasca-061' }),
        uploadedBy: worker.userId,
      })
    ),
    'task_proof uploads are unchanged by migration 061.'
  );

  assertEqual(
    STAGE,
    'task_proof is still never stamped with a cycle after migration 061',
    await readPlantingId(proofStillNullAfter061.id),
    null,
    'Rewriting the trigger body must not disturb the task_proof branch.'
  );

  // ---------- 11.6 Hapus ----------
  //
  // Anggota aktif lain BOLEH MEMBACA foto ini (11.3) dan tetap TIDAK BOLEH
  // menghapusnya. Itu pasangan asersi yang paling mudah longgar: policy DELETE
  // menuntut uploaded_by = auth.uid() DAN can_upload_*, bukan sekadar
  // keanggotaan.

  await assertDeleteBlocked(
    'another active member cannot delete the growth phase photo they can read',
    mate.client,
    phasePhoto.id,
    'The delete policy needs uploaded_by = auth.uid() AND can_upload_growth_phase_record_photo.'
  );

  await assertDeleteBlocked(
    'another active member cannot delete the harvest photo they can read',
    mate.client,
    harvestPhoto.id,
    'The delete policy needs uploaded_by = auth.uid() AND can_upload_harvest_record_photo.'
  );

  await assertDeleteBlocked(
    'a non-member cannot delete the growth phase photo',
    outsider.client,
    phasePhoto.id,
    'Non-members satisfy no delete branch.'
  );

  await assertDeleteBlocked(
    'a non-member cannot delete the harvest photo',
    outsider.client,
    harvestPhoto.id,
    'Non-members satisfy no delete branch.'
  );

  await assertDeleteAllowed(
    'the uploader who is also the recorder deletes their own growth phase photo',
    worker.client,
    spoofedPhasePhoto.id,
    'Delete allows uploaded_by = auth.uid() together with can_upload_growth_phase_record_photo.'
  );

  await assertDeleteAllowed(
    'the uploader who is also the recorder deletes their own harvest photo',
    worker.client,
    spoofedHarvestPhoto.id,
    'Delete allows uploaded_by = auth.uid() together with can_upload_harvest_record_photo.'
  );

  await assertDeleteAllowed(
    'the owner deletes a growth phase photo uploaded by somebody else',
    owner.client,
    phasePhoto.id,
    'is_active_owner is the first branch of the delete policy and covers every entity type.'
  );

  await assertDeleteAllowed(
    'the owner deletes a harvest photo uploaded by somebody else',
    owner.client,
    harvestPhoto.id,
    'is_active_owner is the first branch of the delete policy and covers every entity type.'
  );

  // ---------- 11.7 storage.objects untuk kedua folder baru ----------
  //
  // Tiga policy storage.objects ikut ditulis ulang oleh 061. Tanpa bagian ini
  // cabang barunya tidak teruji sama sekali, dan metadata bisa dijaga rapat
  // sementara berkasnya terbuka -- atau sebaliknya, berkasnya dikunci lebih
  // rapat daripada metadatanya dan foto yang boleh dibaca gagal dimuat.

  const storagePhasePath =
    `farms/${farm.id}/growth-phase-records/${workerPhaseRecordId}/objek-${runId}.jpg`;
  const storageHarvestPath =
    `farms/${farm.id}/harvest-records/${workerHarvestRecordId}/objek-${runId}.jpg`;

  await expectFailure(
    STAGE,
    'a member who is not the recorder cannot upload a growth-phase-records object',
    uploadObject(mate.client, storagePhasePath),
    'The storage insert policy calls can_upload_growth_phase_record_photo, which pins recorded_by.'
  );

  await expectSuccess(
    STAGE,
    'the recording worker uploads a growth-phase-records object',
    uploadObject(worker.client, storagePhasePath),
    'The recorder satisfies can_upload_growth_phase_record_photo.'
  );

  // Berpasangan dengan asersi di atas, dan berlawanan dengan bagian 10.7:
  // `mate` tidak boleh MENGUNGGAH tapi harus bisa MENGUNDUH.
  await expectSuccess(
    STAGE,
    'another active member can download the growth-phase-records object',
    mate.client.storage.from(BUCKET).download(storagePhasePath),
    'The storage read branch mirrors the table read rule: every active farm member.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot download the growth-phase-records object',
    outsider.client.storage.from(BUCKET).download(storagePhasePath),
    'Storage reads are farm-scoped.'
  );

  await expectFailure(
    STAGE,
    'a member who is not the recorder cannot upload a harvest-records object',
    uploadObject(mate.client, storageHarvestPath),
    'The storage insert policy calls can_upload_harvest_record_photo, which pins harvested_by.'
  );

  await expectSuccess(
    STAGE,
    'the recording worker uploads a harvest-records object',
    uploadObject(worker.client, storageHarvestPath),
    'The recorder satisfies can_upload_harvest_record_photo.'
  );

  await expectSuccess(
    STAGE,
    'another active member can download the harvest-records object',
    mate.client.storage.from(BUCKET).download(storageHarvestPath),
    'The storage read branch mirrors the table read rule: every active farm member.'
  );

  await expectFailure(
    STAGE,
    'a non-member cannot download the harvest-records object',
    outsider.client.storage.from(BUCKET).download(storageHarvestPath),
    'Storage reads are farm-scoped.'
  );

  const removedNewObjects = await expectSuccess(
    STAGE,
    'the owner removes both new-folder objects',
    owner.client.storage.from(BUCKET).remove([storagePhasePath, storageHarvestPath]),
    'is_active_owner is the first branch of the storage delete policy.'
  );
  assertEqual(
    STAGE,
    'the owner removal actually removed both new-folder objects',
    removedNewObjects?.length ?? 0,
    2,
    'The owner branch must be able to clean up any object in their farm.'
  );

  // ---------- Pembersihan ----------

  for (const [label, photoId] of [
    ['owner initiative care', ownerCareProofPhoto.id],
    ['two-tree initiative care', multiTreeCarePhoto.id],
    ['post-060 task_proof', proofStillNullPhoto.id],
    ['owner growth phase', ownerPhasePhoto.id],
    ['owner harvest', ownerHarvestPhoto.id],
    ['post-061 task_proof', proofStillNullAfter061.id],
  ]) {
    await assertDeleteAllowed(
      `the owner cleans up the ${label} photo`,
      owner.client,
      photoId,
      'is_active_owner covers every entity type on delete.'
    );
  }
});
