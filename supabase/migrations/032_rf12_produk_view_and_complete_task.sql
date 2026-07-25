-- 032_rf12_produk_view_and_complete_task.sql
-- RF-12 Catatan Produk Perawatan (Iterasi B, changeset B-1)
--
-- Dua perubahan:
--   1. tree_history_view: sertakan kolom `produk` agar riwayat pohon bisa
--      menampilkan merek pupuk/pestisida secara inline.
--   2. complete_task: terima parameter p_produk agar realisasi tugas TERJADWAL
--      juga bisa mencatat produk (mayoritas pemakaian produk lewat jalur ini —
--      semprot 2 minggu sekali, pupuk NPK sebulan sekali).
--
-- Yang TIDAK disentuh (sengaja):
--   - Kolom care_activities.produk  -> sudah ada sejak migration 027.
--   - RPC create_care_activity      -> sudah punya p_produk sejak 027.
--   - RPC postpone_task             -> produk tidak relevan (kerjaan tak dilakukan).
--   - updateLatestTaskRealization   -> edit realisasi belum bisa ubah produk;
--                                      dicatat sebagai celah, ditunda ke UAT.
--   - Kolom is_deleted mana pun     -> utang B4, sengaja ditunda.
--
-- Fakta yang sudah diverifikasi via SQL Editor sebelum migration ini ditulis:
--   - care_activities.asal punya DEFAULT 'terjadwal'::text (NOT NULL).
--     complete_task tidak menyebut `asal` di insert-nya dan mengandalkan default
--     ini. Perilaku tersebut DIPERTAHANKAN apa adanya di bawah.
--   - Trigger validate_care_activity (BEFORE INSERT) hanya memvalidasi akses,
--     tidak menulis kolom apa pun. Tidak terpengaruh penambahan kolom produk.
--   - Trigger sync_task_status_from_activity (AFTER INSERT) hanya membaca
--     new.status dan new.care_task_id. Tidak terpengaruh.
--   - Signature live complete_task saat ini: (p_task_id uuid, p_note text).

begin;

-- ============================================================
-- 1. tree_history_view: tambahkan kolom produk
-- ============================================================
-- Cabang non-care mengisi NULL::text agar jumlah & tipe kolom tetap selaras
-- pada UNION ALL. Hanya cabang 'care' yang membawa nilai sesungguhnya.
--
-- Definisi di bawah adalah salinan persis dari view live (hasil
-- pg_get_viewdef) DENGAN SATU-SATUNYA perubahan: penambahan kolom produk.
-- Tidak ada perubahan lain pada logika title/description/filter.

create or replace view public.tree_history_view as
 select tcr.id as source_id,
    tcr.tree_id,
    tcr.farm_id,
    'condition'::text as history_type,
    tcr.condition_status::text as title,
    tcr.note as description,
    tcr.reported_by as actor_id,
    tcr.reported_at as happened_at,
    null::text as asal,
    null::text as produk
   from tree_condition_reports tcr
  where tcr.is_deleted = false
union all
 select gpr.id as source_id,
    gpr.tree_id,
    gpr.farm_id,
    'phase'::text as history_type,
    gpr.phase::text as title,
    gpr.note as description,
    gpr.recorded_by as actor_id,
    gpr.recorded_at as happened_at,
    null::text as asal,
    null::text as produk
   from growth_phase_records gpr
  where gpr.is_deleted = false
union all
 select ca.id as source_id,
    cat.tree_id,
    ca.farm_id,
    'care'::text as history_type,
    coalesce(ct.title, 'Perawatan inisiatif'::text) as title,
    coalesce(nullif(trim(both from ca.note), ''::text), ca.category::text) as description,
    ca.performed_by as actor_id,
    ca.performed_at as happened_at,
    ca.asal,
    nullif(trim(both from ca.produk), ''::text) as produk
   from care_activities ca
     join care_activity_trees cat on cat.care_activity_id = ca.id
     left join care_tasks ct on ct.id = ca.care_task_id
union all
 select hr.id as source_id,
    hr.tree_id,
    hr.farm_id,
    'harvest'::text as history_type,
    'Panen dicatat'::text as title,
    trim(both from concat('Jumlah buah: ', hr.fruit_count::text,
        case
            when nullif(trim(both from hr.fruit_condition), ''::text) is not null then concat('. Kondisi: ', trim(both from hr.fruit_condition))
            else ''::text
        end,
        case
            when nullif(trim(both from hr.note), ''::text) is not null then concat('. Catatan: ', trim(both from hr.note))
            else ''::text
        end)) as description,
    hr.harvested_by as actor_id,
    hr.harvested_at as happened_at,
    null::text as asal,
    null::text as produk
   from harvest_records hr
  where hr.is_deleted = false;

-- ============================================================
-- 2. complete_task: tambah parameter p_produk
-- ============================================================
-- Signature lama DIHAPUS DULU sebelum membuat yang baru.
-- Alasan: menambah parameter ber-DEFAULT tanpa drop akan menciptakan OVERLOAD
-- (dua fungsi bernama sama), dan pemanggilan dengan 2 argumen menjadi ambigu
-- -> "function is not unique". Ini persis kelas bug yang ditangani migration
-- 024 (fix_operational_report_status_rpc_overload). Jangan diulang.

drop function if exists public.complete_task(uuid, text);

create or replace function public.complete_task(
  p_task_id uuid,
  p_note text default null,
  p_produk text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  task_farm_id uuid;
  task_assigned_to uuid;
  new_activity_id uuid;
begin
  select farm_id, assigned_to
  into task_farm_id, task_assigned_to
  from public.care_tasks
  where id = p_task_id;

  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can complete this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can complete tasks';
  end if;

  -- `asal` sengaja tidak disebut: mengandalkan DEFAULT 'terjadwal' pada kolom,
  -- sama seperti perilaku sebelum migration ini. `category` juga tidak diisi —
  -- constraint care_activities_asal_source_check hanya mewajibkan category
  -- untuk cabang 'inisiatif'.
  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note,
    produk
  )
  values (
    task_farm_id,
    p_task_id,
    current_user_id,
    'completed',
    p_note,
    nullif(trim(p_produk), '')
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$function$;

commit;

-- ============================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
-- ============================================================
--
-- a. Pastikan view sudah membawa produk:
--      select pg_get_viewdef('tree_history_view'::regclass, true);
--    -> cabang care harus punya `nullif(btrim(ca.produk), '') as produk`.
--
-- b. Pastikan complete_task TIDAK ter-overload (harus TEPAT SATU baris):
--      select p.proname, pg_get_function_arguments(p.oid)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'complete_task';
--    -> harus: p_task_id uuid, p_note text DEFAULT NULL::text,
--              p_produk text DEFAULT NULL::text
--    -> kalau muncul DUA baris, drop yang lama gagal. STOP, jangan lanjut ke app.
--
-- c. Pastikan grant/permission tidak hilang akibat drop+create.
--    Cek siapa yang boleh eksekusi:
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'complete_task';
--    -> bandingkan dengan create_care_activity sebagai acuan:
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'create_care_activity';
--    -> kalau complete_task kehilangan grant untuk `authenticated`, tambahkan:
--      grant execute on function public.complete_task(uuid, text, text) to authenticated;
--
-- CATATAN: langkah (c) penting. DROP FUNCTION menghapus grant yang menempel
-- pada fungsi lama. Kalau di project ini grant diberikan eksplisit (bukan
-- lewat default privileges), worker akan kena "permission denied" saat
-- menyelesaikan tugas. Verifikasi sebelum bilang migration ini sukses.
