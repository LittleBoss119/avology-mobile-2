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
//   * tiga policy public.photo_attachments  -- migrasi 053 bagian E.1
//   * tiga policy storage.objects           -- migrasi 053 bagian E.2
//   * empat fungsi pendukung                -- migrasi 019 (126, 145, 207, 232)
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

  const treeId = await expectSuccess(
    STAGE,
    'owner creates a tree with its first planting',
    owner.client.rpc('create_tree_with_planting', {
      p_farm_id: farm.id,
      p_row_position: 1,
      p_column_position: 'A',
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
});
