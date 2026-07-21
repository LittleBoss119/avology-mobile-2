-- Migration 031 — Cleanup Iterasi A
--
-- Membersihkan objek DB yang sudah deprecated setelah pemangkasan Iterasi A:
-- merge catatan perawatan (B2), hapus reopen laporan (B5), cabut soft-delete
-- write path (B4), dan pangkas foto ke 3 entitas (B3a/b/c).
--
-- CATATAN: Migration ini mencerminkan perubahan yang SUDAH diterapkan ke DB live
-- lewat SQL Editor (terverifikasi), dan dicatat di sini agar git sinkron dengan DB.
--
-- Urutan WAJIB: baris data dihapus & policy di-rewrite SEBELUM drop fungsi
-- (policy photo_attachments & storage.objects memanggil fungsi can_*),
-- dan tighten constraint dilakukan TERAKHIR (setelah semua baris pelanggar hilang).

begin;

-- ============================================================
-- 1. Hapus baris data foto untuk entitas yang dibuang
--    (growth_phase_record, harvest_record, operational_report, manual_care_record)
-- ============================================================
delete from photo_attachments
where entity_type in (
  'growth_phase_record',
  'harvest_record',
  'operational_report',
  'manual_care_record'
);

-- ============================================================
-- 2. Rewrite RLS policy photo_attachments → sisakan tree_main, condition_record, task_proof
-- ============================================================
drop policy "Allowed members can view photo attachments" on photo_attachments;
create policy "Allowed members can view photo attachments" on photo_attachments
for select using (
  ((entity_type = 'tree_main') and is_active_farm_member(farm_id, auth.uid()))
  or ((entity_type = 'condition_record') and can_access_condition_record_photo(farm_id, entity_id, auth.uid()))
  or ((entity_type = 'task_proof') and can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
);

drop policy "Allowed members can insert photo attachments" on photo_attachments;
create policy "Allowed members can insert photo attachments" on photo_attachments
for insert with check (
  (uploaded_by = auth.uid())
  and (bucket = 'avology-photos')
  and (avology_storage_path_farm_id(storage_path) = farm_id)
  and (avology_storage_path_entity_id(storage_path) = entity_id)
  and (
    ((entity_type = 'tree_main') and is_active_owner(farm_id, auth.uid()))
    or ((entity_type = 'condition_record') and can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
    or ((entity_type = 'task_proof') and can_upload_task_proof_photo(farm_id, avology_storage_path_task_id(storage_path), entity_id, auth.uid()))
  )
);

drop policy "Allowed members can delete photo attachments" on photo_attachments;
create policy "Allowed members can delete photo attachments" on photo_attachments
for delete using (
  is_active_owner(farm_id, auth.uid())
  or (
    (uploaded_by = auth.uid())
    and (
      ((entity_type = 'condition_record') and can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
      or ((entity_type = 'task_proof') and can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
    )
  )
);

-- ============================================================
-- 3. Rewrite RLS policy storage.objects → sisakan trees, condition-reports, task-proofs
-- ============================================================
drop policy "Allowed members can read avology photo objects" on storage.objects;
create policy "Allowed members can read avology photo objects" on storage.objects
for select using (
  (bucket_id = 'avology-photos')
  and (
    ((avology_storage_path_entity_folder(name) = 'trees') and is_active_farm_member(avology_storage_path_farm_id(name), auth.uid()))
    or ((avology_storage_path_entity_folder(name) = 'condition-reports') and can_access_condition_record_photo(avology_storage_path_farm_id(name), avology_storage_path_entity_id(name), auth.uid()))
    or ((avology_storage_path_entity_folder(name) = 'task-proofs') and can_access_task_proof_photo(avology_storage_path_farm_id(name), avology_storage_path_entity_id(name), auth.uid()))
  )
);

drop policy "Allowed members can upload avology photo objects" on storage.objects;
create policy "Allowed members can upload avology photo objects" on storage.objects
for insert with check (
  (bucket_id = 'avology-photos')
  and (
    ((avology_storage_path_entity_folder(name) = 'trees') and (split_part(name, '/', 5) = 'main') and is_active_owner(avology_storage_path_farm_id(name), auth.uid()))
    or ((avology_storage_path_entity_folder(name) = 'condition-reports') and can_upload_condition_record_photo(avology_storage_path_farm_id(name), avology_storage_path_entity_id(name), auth.uid()))
    or ((avology_storage_path_entity_folder(name) = 'task-proofs') and can_upload_task_proof_photo(avology_storage_path_farm_id(name), avology_storage_path_task_id(name), avology_storage_path_entity_id(name), auth.uid()))
  )
);

drop policy "Allowed members can delete avology photo objects" on storage.objects;
create policy "Allowed members can delete avology photo objects" on storage.objects
for delete using (
  (bucket_id = 'avology-photos')
  and (
    is_active_owner(avology_storage_path_farm_id(name), auth.uid())
    or (exists (select 1 from photo_attachments pa where pa.bucket = objects.bucket_id and pa.storage_path = objects.name and pa.uploaded_by = auth.uid()))
    or (
      (not (exists (select 1 from photo_attachments pa where pa.bucket = objects.bucket_id and pa.storage_path = objects.name)))
      and (
        ((avology_storage_path_entity_folder(name) = 'condition-reports') and can_upload_condition_record_photo(avology_storage_path_farm_id(name), avology_storage_path_entity_id(name), auth.uid()))
        or ((avology_storage_path_entity_folder(name) = 'task-proofs') and can_upload_task_proof_photo(avology_storage_path_farm_id(name), avology_storage_path_task_id(name), avology_storage_path_entity_id(name), auth.uid()))
      )
    )
  )
);

-- ============================================================
-- 4. Drop fungsi foto untuk entitas yang dibuang (condition & task_proof disisakan)
-- ============================================================
drop function if exists can_access_growth_phase_record_photo(uuid, uuid, uuid);
drop function if exists can_upload_growth_phase_record_photo(uuid, uuid, uuid);
drop function if exists can_access_harvest_record_photo(uuid, uuid, uuid);
drop function if exists can_upload_harvest_record_photo(uuid, uuid, uuid);
drop function if exists can_access_operational_report_photo(uuid, uuid, uuid);
drop function if exists can_upload_operational_report_photo(uuid, uuid, uuid);
drop function if exists can_access_manual_care_record_photo(uuid, uuid, uuid);
drop function if exists can_upload_manual_care_record_photo(uuid, uuid, uuid);

-- ============================================================
-- 5. Drop RPC deprecated (reopen, soft-delete, manual care)
-- ============================================================
drop function if exists reopen_operational_report(uuid, text);
drop function if exists soft_delete_own_tree_condition_report(uuid, text);
drop function if exists soft_delete_own_growth_phase_record(uuid, text);
drop function if exists soft_delete_own_harvest_record(uuid, text);
drop function if exists soft_delete_own_manual_care_record(uuid, text);
drop function if exists update_own_manual_care_record(uuid, care_category, target_type, text, text, uuid, text, text, timestamp with time zone);

-- ============================================================
-- 6. Drop tabel deprecated + backup
-- ============================================================
drop table if exists manual_care_records;
drop table if exists backup_care_activities;
drop table if exists backup_manual_care_records;

-- ============================================================
-- 7. Tighten constraint photo_attachments → 3 entitas (TERAKHIR)
-- ============================================================
alter table photo_attachments drop constraint photo_attachments_entity_type_check;
alter table photo_attachments add constraint photo_attachments_entity_type_check
  check (entity_type = any (array['tree_main'::text, 'condition_record'::text, 'task_proof'::text]));

alter table photo_attachments drop constraint photo_attachments_storage_path_entity_folder_check;
alter table photo_attachments add constraint photo_attachments_storage_path_entity_folder_check
  check (avology_storage_path_entity_folder(storage_path) =
    case entity_type
      when 'tree_main'::text then 'trees'::text
      when 'condition_record'::text then 'condition-reports'::text
      when 'task_proof'::text then 'task-proofs'::text
      else null::text
    end);

commit;

-- ============================================================
-- CATATAN PENUTUP (di luar SQL, dikerjakan terpisah):
-- - File storage di bucket avology-photos folder growth-phase-records/,
--   harvest-records/, operational-reports/, manual-care-records/ dihapus
--   lewat Storage dashboard (data test).
-- - Tabel snapshot _backup_031_* (manual_care_records, photo_attachments_removed,
--   manual_care_photos) di-drop setelah verifikasi app berjalan benar.
-- - Kolom soft-delete (is_deleted dkk) di tree_condition_reports / growth_phase_records
--   / harvest_records SENGAJA tidak di-drop di sini — ditunda ke migration terpisah
--   karena butuh update view tree_history_view (028) secara bersamaan.
-- ============================================================
