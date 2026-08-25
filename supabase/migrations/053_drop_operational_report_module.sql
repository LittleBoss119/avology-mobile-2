-- 053_drop_operational_report_module.sql
--
-- Modul laporan operasional dibuang seluruhnya.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Fungsi laporan operasional tumpang tindih dengan kategori catatan aktivitas
-- pada pohon, dan alur "pekerja melapor -> owner memutuskan -> tugas terbit"
-- tidak terpakai. Yang dibuang: tabel operational_reports berikut dua enum-nya,
-- tujuh fungsi, dua trigger, dua policy, satu kolom pada care_tasks, dan cabang
-- 'operational_report' di seluruh constraint serta policy foto.
--
-- ---------------------------------------------------------------------------
-- PRASYARAT
--
--   * 046-052 sudah dijalankan dan terverifikasi.
--   * Objek storage di farms/*/operational-reports/** SUDAH dihapus manual
--     lewat dashboard Supabase sebelum migrasi ini dijalankan. Migrasi ini
--     hanya membersihkan baris photo_attachments-nya; DDL tidak bisa menyentuh
--     isi bucket.
--
-- ---------------------------------------------------------------------------
-- URUTAN EKSEKUSI -- BERBEDA DARI URUTAN DI INSTRUKSI, DAN PERBEDAANNYA WAJIB
--
-- Instruksi menyusun: drop fungsi (1.4) -> drop tabel (1.5) -> constraint foto
-- (1.6) -> tulis ulang policy (1.7). Urutan itu GAGAL di PostgreSQL karena dua
-- ketergantungan yang dicatat pg_depend:
--
--   1. Keenam policy foto memanggil can_access_operational_report_photo() dan
--      can_upload_operational_report_photo() di dalam ekspresinya. Ekspresi
--      policy MENCATAT ketergantungan pada fungsi, sehingga `drop function`
--      tanpa cascade akan ditolak selama policy-nya masih memakai:
--        ERROR: cannot drop function ... because other objects depend on it
--      -> policy harus ditulis ulang LEBIH DULU.
--
--   2. Trigger validate_operational_report_insert_trigger bergantung pada
--      validate_operational_report_insert(). Fungsinya tidak bisa dibuang
--      selama trigger-nya hidup, dan trigger itu baru mati saat tabelnya
--      di-drop.
--      -> drop table harus mendahului drop function yang satu itu.
--
-- Urutan yang dipakai di bawah, dengan nomor langkah instruksi di kurung:
--
--   A (1.1)   bersihkan data turunan
--   B (1.2)   lepaskan care_tasks dari laporan
--   C (1.3)   tulis ulang validate_care_task()
--   D (1.6)   persempit constraint photo_attachments
--   E (1.7)   tulis ulang enam policy        <- naik, melepas ketergantungan 1
--   F (1.5.1) drop tabel operational_reports <- ikut membuang trigger & policy
--   G (1.4)   drop tujuh fungsi              <- turun, kini bebas dependensi
--   H (1.5.2) drop dua enum                  <- setelah fungsi & tabel pemakainya
--
-- Isi setiap langkah TIDAK berubah dari instruksi; hanya posisinya yang
-- digeser, dan hanya sejauh yang dipaksa kedua ketergantungan di atas.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * avology_storage_path_farm_id / _entity_folder / _entity_id / _task_id --
--     keempatnya generik dan masih dipakai tree_main, condition_record, dan
--     task_proof.
--   * can_access/can_upload_condition_record_photo dan padanan task_proof --
--     dipertahankan verbatim di seluruh policy yang ditulis ulang.
--   * tree_condition_reports dan segala hal tentangnya. Tabel itu BUKAN bagian
--     modul ini walau layarnya bernama report.tsx.
--   * trees, dan karenanya prevent_tree_delete_trigger tidak relevan di sini.
--   * reopen_operational_report -- dibuat migrasi 020, TIDAK ADA di database
--     live (drift lama, sudah diverifikasi lewat pg_proc). Tetap ditulis dengan
--     `if exists` supaya migrasi ini jalan di database mana pun.

begin;

-- ===========================================================================
-- A. (1.1) Bersihkan data turunan
--
-- Seluruhnya WAJIB mendahului langkah B: constraint care_tasks_source_check
-- yang baru menolak baris care_tasks tanpa care_schedule_id.
-- ===========================================================================

-- A.1 -- foto laporan operasional.
-- entity_id TIDAK punya foreign key (013:31), jadi tidak ada CASCADE yang
-- membersihkannya saat tabel laporan di-drop.
delete from public.photo_attachments
where entity_type = 'operational_report';

-- A.2 -- foto bukti kerja milik tugas yang lahir dari laporan.
--
-- PENTING soal apa yang disimpan entity_id. Untuk entity_type 'task_proof',
-- photo_attachments.entity_id menunjuk care_activities.id, BUKAN care_tasks.id
-- (photoAttachmentService.ts:685 mengirim activityId sebagai entityId).
-- Id tugasnya tidak pernah masuk kolom mana pun -- ia hanya hidup di segmen
-- keempat storage_path, dan itulah yang dibaca avology_storage_path_task_id()
-- (019:68-83), sementara avology_storage_path_entity_id() membaca segmen
-- kelima untuk folder ini (019:57-59). Pemisahan yang sama terbaca di
-- signature can_upload_task_proof_photo(p_farm_id, p_task_id, p_activity_id,
-- p_user_id) di 019:232-236.
--
-- Karena itu penghapusan di bawah menjembatani lewat care_activities. Menulis
-- `entity_id in (select id from care_tasks ...)` akan menghapus NOL baris tanpa
-- error -- kegagalan diam yang justru meninggalkan yatim yang mau dicegah.
--
-- WAJIB sebelum A.3: begitu care_tasks dihapus, care_activities ikut lenyap
-- lewat CASCADE dan join di bawah kehilangan barisnya untuk selamanya.
delete from public.photo_attachments pa
where pa.entity_type = 'task_proof'
  and exists (
    select 1
    from public.care_activities ca
    join public.care_tasks ct on ct.id = ca.care_task_id
    where ca.id = pa.entity_id
      and ct.care_schedule_id is null
  );

-- A.3 -- tugas yang lahir dari laporan.
--
-- care_schedule_id IS NULL adalah penandanya: sebelum migrasi ini,
-- care_tasks_source_check (004:126) mewajibkan salah satu dari care_schedule_id
-- atau operational_report_id terisi, jadi tugas tanpa jadwal PASTI berasal dari
-- laporan.
--
-- care_activities ikut terhapus lewat CASCADE (004:171), dan
-- care_activity_trees menyusul lewat CASCADE-nya sendiri (025:54-55).
--
-- CASCADE ke care_activities membangunkan zz_cleanup_orphan_recurring_schedule_
-- trigger (041:235-238). Sudah diperiksa dan aman: fungsinya keluar lebih awal
-- saat source_task.care_schedule_id is null (041:198-200) -- persis kondisi
-- setiap baris yang dihapus di sini. Ia juga hanya menjalankan DELETE, tidak
-- pernah INSERT/UPDATE ke care_tasks, sehingga validate_care_task_trigger
-- (yang masih memakai definisi lama saat baris ini jalan) tidak terpicu.
delete from public.care_tasks
where care_schedule_id is null;

-- ===========================================================================
-- B. (1.2) Lepaskan care_tasks dari laporan
-- ===========================================================================

-- B.1 -- constraint lama menyebut kolom yang akan dibuang.
alter table public.care_tasks
  drop constraint if exists care_tasks_source_check;

-- B.2 -- kolomnya. FK care_tasks_operational_report_id_fkey (004:110) dan index
-- idx_care_tasks_operational_report (006:43-44) ikut terbuang bersama kolom.
--
-- Sengaja TANPA cascade: kalau ternyata masih ada objek lain yang bergantung
-- pada kolom ini, migrasi HARUS gagal keras supaya ketahuan, bukan diam-diam
-- ikut membuangnya (pelajaran 044:184-190).
alter table public.care_tasks
  drop column if exists operational_report_id;

-- B.3 -- constraint pengganti.
--
-- Menjaga jaminan "setiap tugas punya sumber" yang dulu dipegang 004:126-127.
-- Aman divalidasi penuh tanpa NOT VALID: A.3 sudah membuang seluruh baris yang
-- melanggarnya.
--
-- CATATAN soal interaksi dengan FK. care_schedule_id memakai `on delete set
-- null` (004:109), jadi constraint ini membuat penghapusan care_schedules yang
-- masih punya tugas GAGAL sebagai pelanggaran CHECK, bukan menyetel NULL. Itu
-- sudah diperiksa dan bukan jalur nyata: satu-satunya tempat care_schedules
-- dihapus adalah cleanup_orphan_recurring_schedule(), dan ia menghapus
-- tugasnya lebih dulu (041:217) baru jadwalnya (041:218). Perilaku ini
-- diketahui dan diterima.
alter table public.care_tasks
  add constraint care_tasks_source_check
  check (care_schedule_id is not null);

-- ===========================================================================
-- C. (1.3) validate_care_task() -- buang pembacaan operational_reports
--
-- Asal: 046:81-147, versi hidup terakhir (047-052 hanya merujuknya di komentar,
-- tidak ada yang mendefinisikan ulang).
--
-- SATU-SATUNYA perubahan: blok `if new.operational_report_id is not null`
-- (046:103-111) dibuang berikut variabel report_farm_id (046:89). Kolomnya
-- sudah tidak ada sejak B.2, jadi badan lama akan meledak pada INSERT/UPDATE
-- care_tasks berikutnya.
--
-- Seluruh sisanya VERBATIM, termasuk pesan exception berbahasa Inggris:
-- penjaga kesamaan kebun untuk jadwal, penjaga kesamaan kebun untuk pohon
-- target, penjaga pekerja aktif untuk assigned_to, dan penjaga owner aktif
-- untuk assigned_by. Tidak ada validasi baru yang ditambahkan.
--
-- `create or replace` disengaja: signature-nya tidak berubah, dan drop akan
-- ikut membuang trigger validate_care_task_trigger yang menempel padanya.
-- ===========================================================================

create or replace function public.validate_care_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_farm_id uuid;
  tree_farm_id uuid;
begin
  if new.care_schedule_id is not null then
    select farm_id
    into schedule_farm_id
    from public.care_schedules
    where id = new.care_schedule_id;

    if schedule_farm_id is distinct from new.farm_id then
      raise exception 'Care task schedule must belong to the same farm';
    end if;
  end if;

  if new.target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'Care task target tree must belong to the same farm';
    end if;
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.assigned_to
      and role = 'worker'
      and status = 'active'
  ) then
    raise exception 'Care tasks can only be assigned to active workers';
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.assigned_by
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Care tasks can only be assigned by active owners';
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- D. (1.6) Persempit constraint photo_attachments
--
-- Aman divalidasi penuh: A.1 sudah membuang seluruh baris 'operational_report'.
-- ===========================================================================

alter table public.photo_attachments
  drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
  add constraint photo_attachments_entity_type_check
  check (entity_type = any (array[
    'tree_main'::text,
    'condition_record'::text,
    'task_proof'::text
  ]));

alter table public.photo_attachments
  drop constraint if exists photo_attachments_storage_path_entity_folder_check;

alter table public.photo_attachments
  add constraint photo_attachments_storage_path_entity_folder_check
  check (
    public.avology_storage_path_entity_folder(storage_path) =
    case entity_type
      when 'tree_main' then 'trees'
      when 'condition_record' then 'condition-reports'
      when 'task_proof' then 'task-proofs'
      else null
    end
  );

-- ===========================================================================
-- E. (1.7) Tulis ulang enam policy foto
--
-- Asal SELURUHNYA migrasi 035 (photo_attachments 035:107-165, storage.objects
-- 035:172-264) -- definisi hidup terakhir; tidak ada migrasi setelahnya yang
-- menyentuh keenamnya.
--
-- Perubahan tunggal per policy: cabang 'operational_report' / folder
-- 'operational-reports' dibuang. Cabang tree_main, condition_record, dan
-- task_proof dipertahankan VERBATIM, termasuk urutannya, termasuk pemakaian
-- can_upload_* vs can_access_* yang berbeda-beda antar policy.
--
-- Klausa `to <role>` sengaja TIDAK ditambahkan: keenam policy di 035 memang
-- tanpa klausa itu (default `to public`), dan menambahkannya diam-diam akan
-- menggeser perilaku di luar lingkup migrasi ini.
--
-- Langkah ini WAJIB mendahului G: tanpa itu, drop kedua fungsi foto laporan
-- ditolak karena policy di bawah masih bergantung padanya.
-- ===========================================================================

-- E.1 -- public.photo_attachments

drop policy if exists "Allowed members can view photo attachments"
  on public.photo_attachments;

create policy "Allowed members can view photo attachments"
  on public.photo_attachments
  for select
  using (
    (entity_type = 'tree_main' and public.is_active_farm_member(farm_id, auth.uid()))
    or (entity_type = 'condition_record'
        and public.can_access_condition_record_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'task_proof'
        and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
  );

drop policy if exists "Allowed members can insert photo attachments"
  on public.photo_attachments;

create policy "Allowed members can insert photo attachments"
  on public.photo_attachments
  for insert
  with check (
    uploaded_by = auth.uid()
    and bucket = 'avology-photos'
    and public.avology_storage_path_farm_id(storage_path) = farm_id
    and public.avology_storage_path_entity_id(storage_path) = entity_id
    and (
      (entity_type = 'tree_main' and public.is_active_owner(farm_id, auth.uid()))
      or (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
      or (entity_type = 'task_proof'
          and public.can_upload_task_proof_photo(
            farm_id,
            public.avology_storage_path_task_id(storage_path),
            entity_id,
            auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete photo attachments"
  on public.photo_attachments;

create policy "Allowed members can delete photo attachments"
  on public.photo_attachments
  for delete
  using (
    public.is_active_owner(farm_id, auth.uid())
    or (
      uploaded_by = auth.uid()
      and (
        (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'task_proof'
          and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
      )
    )
  );

-- E.2 -- storage.objects

drop policy if exists "Allowed members can read avology photo objects"
  on storage.objects;

create policy "Allowed members can read avology photo objects"
  on storage.objects
  for select
  using (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and public.is_active_farm_member(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_access_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_access_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can upload avology photo objects"
  on storage.objects;

create policy "Allowed members can upload avology photo objects"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and split_part(name, '/', 5) = 'main'
        and public.is_active_owner(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_upload_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_upload_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_task_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete avology photo objects"
  on storage.objects;

create policy "Allowed members can delete avology photo objects"
  on storage.objects
  for delete
  using (
    bucket_id = 'avology-photos'
    and (
      public.is_active_owner(public.avology_storage_path_farm_id(name), auth.uid())
      or exists (
        select 1 from public.photo_attachments pa
        where pa.bucket = objects.bucket_id
          and pa.storage_path = objects.name
          and pa.uploaded_by = auth.uid()
      )
      or (
        not exists (
          select 1 from public.photo_attachments pa
          where pa.bucket = objects.bucket_id
            and pa.storage_path = objects.name
        )
        and (
          (public.avology_storage_path_entity_folder(name) = 'condition-reports'
            and public.can_upload_condition_record_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
            and public.can_upload_task_proof_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_task_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
        )
      )
    )
  );

-- ===========================================================================
-- F. (1.5.1) Drop tabel operational_reports
--
-- Ikut terbuang bersama tabelnya:
--   * trigger set_operational_reports_updated_at         (006:446-450)
--   * trigger validate_operational_report_insert_trigger (006:482-486)
--     -> inilah yang melepas validate_operational_report_insert() untuk G
--   * policy "Owners view farm operational reports and workers view own
--     reports" (007:182-192)
--   * policy "Active worker can insert operational reports" (007:195-202)
--   * grant select, insert untuk authenticated (007:353)
--
-- Sengaja TANPA cascade. FK satu-satunya yang menunjuk ke sini sudah dibuang
-- di B.2; kalau ternyata masih ada yang lain, migrasi HARUS gagal keras.
-- ===========================================================================

drop table if exists public.operational_reports;

-- ===========================================================================
-- G. (1.4) Drop tujuh fungsi laporan
--
-- Signature ditulis lengkap dan persis. Semuanya `if exists`:
-- reopen_operational_report tidak ada di database live walau dibuat migrasi 020
-- dan tidak pernah di-drop -- drift lama yang sudah diverifikasi lewat pg_proc.
--
-- Sengaja TANPA cascade di semuanya. E sudah melepas ketergantungan policy dan
-- F sudah melepas ketergantungan trigger, jadi kalau salah satu masih ditolak
-- di sini berarti ada pemakai yang belum terpetakan dan migrasi HARUS berhenti.
-- ===========================================================================

drop function if exists public.update_operational_report_status(
  uuid, public.operational_report_status, text, text
);

drop function if exists public.create_task_from_operational_report(
  uuid, uuid, date, text, text, public.target_type, public.care_category,
  uuid, text, boolean, text
);

drop function if exists public.update_own_operational_report(
  uuid, public.operational_report_category, text, text
);

drop function if exists public.delete_own_operational_report(uuid);

drop function if exists public.reopen_operational_report(uuid);

drop function if exists public.can_access_operational_report_photo(uuid, uuid, uuid);

drop function if exists public.can_upload_operational_report_photo(uuid, uuid, uuid);

drop function if exists public.validate_operational_report_insert();

-- ===========================================================================
-- H. (1.5.2) Drop dua enum
--
-- WAJIB paling akhir. Keduanya dipakai di SIGNATURE
-- update_operational_report_status dan update_own_operational_report (dibuang
-- di G) serta di kolom operational_reports.status/.category (dibuang di F).
--
-- Sengaja TANPA cascade: kalau masih ada pemakai, berhenti keras.
-- ===========================================================================

drop type if exists public.operational_report_status;

drop type if exists public.operational_report_category;

-- ===========================================================================
-- I. Muat ulang cache schema PostgREST
--
-- Tabel, kolom care_tasks.operational_report_id, dan empat RPC yang dipanggil
-- klien lenyap sekaligus. Tanpa reload, klien lama masih melihatnya di cache
-- dan kena error yang membingungkan alih-alih 404 yang jujur.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Tabel dan enum benar-benar hilang -- harus NULL, lalu 0:
--
--      select to_regclass('public.operational_reports');
--      select count(*) from pg_type t
--        join pg_namespace n on n.oid = t.typnamespace
--       where n.nspname = 'public'
--         and t.typname in ('operational_report_status',
--                           'operational_report_category');
--
-- 2. Nol fungsi laporan tersisa -- harus 0 baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname like '%operational_report%';
--
-- 3. Kolom dan constraint care_tasks:
--
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='care_tasks'
--         and column_name='operational_report_id';        -- harus 0 baris
--
--      select pg_get_constraintdef(oid) from pg_constraint
--       where conrelid='public.care_tasks'::regclass
--         and conname='care_tasks_source_check';
--      -- harus: CHECK ((care_schedule_id IS NOT NULL))
--
-- 4. validate_care_task() tidak lagi menyebut operational_report -- harus false:
--
--      select prosrc like '%operational_report%'
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='validate_care_task';
--
-- 5. Keenam policy hidup dan tidak menyebut laporan -- 6 baris, semua false:
--
--      select policyname,
--             coalesce(qual,'') || coalesce(with_check,'') like '%operational%'
--      from pg_policies
--      where policyname in (
--        'Allowed members can view photo attachments',
--        'Allowed members can insert photo attachments',
--        'Allowed members can delete photo attachments',
--        'Allowed members can read avology photo objects',
--        'Allowed members can upload avology photo objects',
--        'Allowed members can delete avology photo objects');
--
-- 6. Nol baris foto yatim -- keduanya harus 0:
--
--      select count(*) from public.photo_attachments
--       where entity_type = 'operational_report';
--
--      select count(*) from public.photo_attachments pa
--       where pa.entity_type = 'task_proof'
--         and not exists (select 1 from public.care_activities ca
--                          where ca.id = pa.entity_id);
--
-- 7. Nol tugas tanpa jadwal -- harus 0:
--
--      select count(*) from public.care_tasks where care_schedule_id is null;
--
-- 8. UJI DI PERANGKAT, bukan hanya SQL: unggah foto kondisi pohon baru, lalu
--    buka kembali detail catatannya. Inilah yang paling mungkin rusak kalau
--    salah satu policy di E salah tulis, dan satu-satunya kategori yang
--    sekarang menggantikan fungsi laporan.
-- ===========================================================================
