-- 047_drop_row_column_target.sql
--
-- Tiga hal sekaligus:
--   1. Membuang target 'row' dan 'column' dari model perawatan.
--   2. Mewajibkan care_tasks.category.
--   3. Membersihkan satu fungsi yatim yang ditinggalkan migrasi 046.
--
-- PRASYARAT: 046 sudah dijalankan dan terverifikasi, dan seluruh tabel care_*
-- kosong. Tidak ada backfill di migrasi ini karena tidak ada baris untuk
-- di-backfill -- termasuk nol baris bertarget 'row'/'column' dan nol baris
-- care_tasks dengan category NULL.
--
-- CATATAN ENUM: nilai 'row' dan 'column' SENGAJA dibiarkan hidup di enum
-- public.target_type. PostgreSQL tidak punya `alter type ... drop value`, dan
-- membuat tipe baru + `alter column ... type ... using` demi dua nilai mati
-- tidak sepadan risikonya. Penutupannya lewat CHECK constraint di bagian 4:
-- nilainya ada di katalog, tapi tidak bisa lagi masuk ke tabel mana pun.
--
-- Yang SENGAJA TIDAK disentuh (migrasi 048-051): grace_days, missed_at,
-- postpone_task, complete_task, care_activity_trees, dan segala hal soal
-- keanggotaan.

begin;

-- ===========================================================================
-- 1. Fungsi yatim sisa 046
--
-- validate_care_sop() ditinggalkan hidup oleh 046 karena di luar lingkup
-- migrasi itu. Trigger satu-satunya yang memanggilnya (validate_care_sop_trigger)
-- sudah dibuang bersama tabel care_sops, jadi fungsi ini tidak bisa dieksekusi
-- oleh apa pun dan badannya merujuk tabel yang sudah tidak ada.
--
-- Ini SATU-SATUNYA fungsi validator yatim yang tersisa: padanannya untuk
-- manual_care_records sudah dibuang di 044:200.
-- ===========================================================================

drop function if exists public.validate_care_sop();

-- ===========================================================================
-- 2-4. Kolom target_row / target_column dan constraint target
--
-- URUTAN WAJIB, sama seperti pelajaran 046: drop constraint EKSPLISIT dulu,
-- baru drop column, baru pasang ulang. `alter table ... drop column` ikut
-- membuang constraint yang menyebut kolom itu TANPA pesan apa pun -- kalau
-- mengandalkan constraint bertahan, hasilnya tabel tanpa validasi target sama
-- sekali dan tidak ada yang memberi tahu.
-- ===========================================================================

-- 2a. Lepas constraint target lama pada kedua tabel.
alter table public.care_schedules
  drop constraint if exists care_schedules_target_check;

alter table public.care_tasks
  drop constraint if exists care_tasks_target_check;

-- 2b. Buang kolomnya.
alter table public.care_schedules
  drop column if exists target_row,
  drop column if exists target_column;

alter table public.care_tasks
  drop column if exists target_row,
  drop column if exists target_column;

-- 3a. Pasang ulang constraint target care_schedules -- tinggal tiga cabang.
alter table public.care_schedules
  add constraint care_schedules_target_check
  check (
    (
      target_type = 'farm'
      and target_tree_id is null
      and custom_target_note is null
    )
    or (
      target_type = 'tree'
      and target_tree_id is not null
      and custom_target_note is null
    )
    or (
      target_type = 'custom'
      and target_tree_id is null
      and custom_target_note is not null
    )
  );

-- 3b. Padanannya untuk care_tasks (asal 004:128).
alter table public.care_tasks
  add constraint care_tasks_target_check
  check (
    (
      target_type = 'farm'
      and target_tree_id is null
      and custom_target_note is null
    )
    or (
      target_type = 'tree'
      and target_tree_id is not null
      and custom_target_note is null
    )
    or (
      target_type = 'custom'
      and target_tree_id is null
      and custom_target_note is not null
    )
  );

-- 4. Tutup nilai enum yang sudah tidak dipakai.
--
-- Constraint terpisah, bukan digabung ke *_target_check di atas. Alasannya
-- pesan error: kalau digabung, baris ber-target_type 'row' gagal dengan pesan
-- yang sama seperti baris 'tree' tanpa target_tree_id, dan penyebabnya tidak
-- terbaca. Terpisah, namanya sendiri yang menjelaskan.
alter table public.care_schedules
  drop constraint if exists care_schedules_target_type_allowed_check;

alter table public.care_schedules
  add constraint care_schedules_target_type_allowed_check
  check (target_type in ('farm', 'tree', 'custom'));

alter table public.care_tasks
  drop constraint if exists care_tasks_target_type_allowed_check;

alter table public.care_tasks
  add constraint care_tasks_target_type_allowed_check
  check (target_type in ('farm', 'tree', 'custom'));

-- ===========================================================================
-- 5. care_tasks.category wajib
--
-- Kolom ini lahir nullable di 004:114 dan tidak pernah disentuh sejak itu.
-- Satu-satunya jalur yang bisa menghasilkan NULL adalah
-- create_task_from_operational_report, yang di bagian 6 di bawah juga
-- diperketat supaya p_category wajib.
--
-- Tanpa NOT VALID: tabelnya kosong, jadi validasi penuh tidak memindai apa pun.
-- ===========================================================================

alter table public.care_tasks
  alter column category set not null;

-- ===========================================================================
-- 6. Fungsi yang menulis target
--
-- Empat fungsi menyentuh target_row/target_column. Dua di antaranya berubah
-- signature dan WAJIB di-drop lebih dulu: `create or replace` dengan daftar
-- parameter berbeda hanya membuat OVERLOAD baru, lalu PostgREST menghadapi dua
-- kandidat dan bisa memilih yang salah -- persis kelas bug yang ditangani
-- migrasi 024 dan diperingatkan ulang di 043:110-118.
--
-- assign_worker_to_care_schedule TIDAK berubah signature (tetap uuid, uuid);
-- hanya badannya yang menyebut target_row/target_column. Karena itu ia memakai
-- `create or replace` dan grant-nya tidak perlu ditulis ulang.
-- create_next_recurring_schedule adalah fungsi trigger tanpa parameter, jadi
-- sama halnya.
-- ===========================================================================

-- 6a. create_manual_schedule -- kehilangan p_target_row dan p_target_column.
drop function if exists public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean, integer
);

create or replace function public.create_manual_schedule(
  p_farm_id uuid,
  p_title text,
  p_category public.care_category,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_instruction text default null,
  p_requires_photo boolean default false,
  p_repeat_every_days integer default null
)
returns table (schedule_id uuid, task_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_schedule_id uuid;
  new_task_id uuid;
  repeat_days integer;
begin
  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can create manual schedules';
  end if;

  if not public.is_active_worker(p_farm_id, p_assigned_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  repeat_days := nullif(greatest(coalesce(p_repeat_every_days, 0), 0), 0);

  new_schedule_id := gen_random_uuid();

  insert into public.care_schedules (
    id, farm_id, title, category, scheduled_date, target_type,
    target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    new_schedule_id, p_farm_id, p_title, p_category, p_scheduled_date,
    p_target_type, p_target_tree_id,
    p_custom_target_note, p_instruction, coalesce(p_requires_photo, false),
    current_user_id,
    repeat_days,
    case when repeat_days is null then null else new_schedule_id end,
    null
  );

  insert into public.care_tasks (
    farm_id, care_schedule_id, assigned_to, assigned_by, title, category,
    instruction, target_type, target_tree_id,
    custom_target_note, due_date, requires_photo
  ) values (
    p_farm_id, new_schedule_id, p_assigned_worker_id, current_user_id,
    p_title, p_category, p_instruction, p_target_type, p_target_tree_id,
    p_custom_target_note, p_scheduled_date, coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id;
end;
$$;

revoke execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer
) from public, anon;

grant execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer
) to authenticated;

-- 6b. create_task_from_operational_report -- kehilangan dua parameter target,
--     DAN p_category menjadi wajib.
--
-- URUTAN PARAMETER BERUBAH. p_category sebelumnya duduk di antara
-- p_requires_photo dan p_owner_response_note, keduanya berdefault. PostgreSQL
-- melarang parameter tanpa default muncul SETELAH parameter berdefault, jadi
-- begitu `default null` dicabut dari p_category, ia harus naik ke blok
-- parameter wajib. Klien memanggil lewat PostgREST dengan argumen bernama,
-- sehingga urutan posisional tidak memengaruhi pemanggilan -- tetapi signature
-- di grant/revoke di bawah harus mengikuti urutan baru ini.
drop function if exists public.create_task_from_operational_report(
  uuid, uuid, date, text, text, public.target_type,
  text, text, uuid, text, boolean, public.care_category, text
);

create or replace function public.create_task_from_operational_report(
  p_operational_report_id uuid,
  p_assigned_worker_id uuid,
  p_due_date date,
  p_title text,
  p_instruction text,
  p_target_type public.target_type,
  p_category public.care_category,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_requires_photo boolean default false,
  p_owner_response_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_report record;
  new_task_id uuid;
  final_note text;
begin
  select id, farm_id, status, owner_response_note
  into target_report
  from public.operational_reports
  where id = p_operational_report_id;

  if not found then
    raise exception 'Operational report not found';
  end if;

  if not public.is_active_owner(target_report.farm_id, current_user_id) then
    raise exception 'Only active owners can create task from operational report';
  end if;

  if target_report.status not in ('new', 'in_progress') then
    raise exception 'Operational report is already closed';
  end if;

  if not public.is_active_worker(target_report.farm_id, p_assigned_worker_id) then
    raise exception 'Report follow-up tasks can only be assigned to active workers';
  end if;

  -- Parameter sudah wajib di level signature, tetapi pemanggil masih bisa
  -- mengirim NULL secara eksplisit lewat PostgREST. Ditolak di sini supaya
  -- pesannya terbaca, bukan berupa pelanggaran NOT NULL dari tabel.
  if p_category is null then
    raise exception 'Kategori perawatan wajib diisi.';
  end if;

  if exists (
    select 1 from public.care_tasks t
    where t.operational_report_id = p_operational_report_id
      and t.status in ('pending', 'postponed')
  ) then
    raise exception 'Operational report already has an open follow up task';
  end if;

  if p_owner_response_note is null then
    final_note := target_report.owner_response_note;
  else
    final_note := nullif(btrim(p_owner_response_note), '');
  end if;

  insert into public.care_tasks (
    farm_id, operational_report_id, assigned_to, assigned_by,
    title, category, instruction,
    target_type, target_tree_id, custom_target_note,
    due_date, requires_photo
  )
  values (
    target_report.farm_id, p_operational_report_id, p_assigned_worker_id, current_user_id,
    p_title, p_category, p_instruction,
    p_target_type, p_target_tree_id, p_custom_target_note,
    p_due_date, coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  update public.operational_reports
  set status = 'in_progress'::public.operational_report_status,
      resolution = 'task',
      owner_response_note = final_note,
      responded_by = current_user_id,
      responded_at = now(),
      resolved_at = null,
      updated_at = now()
  where id = p_operational_report_id;

  return new_task_id;
end;
$function$;

revoke execute on function public.create_task_from_operational_report(
  uuid, uuid, date, text, text, public.target_type, public.care_category,
  uuid, text, boolean, text
) from public, anon;

grant execute on function public.create_task_from_operational_report(
  uuid, uuid, date, text, text, public.target_type, public.care_category,
  uuid, text, boolean, text
) to authenticated;

-- 6c. assign_worker_to_care_schedule -- signature TETAP (uuid, uuid).
-- Hanya daftar kolom INSERT yang berubah, jadi `create or replace` sudah cukup
-- dan grant yang sudah menempel tetap utuh.
create or replace function public.assign_worker_to_care_schedule(
  p_schedule_id uuid,
  p_worker_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target public.care_schedules%rowtype;
  new_task_id uuid;
begin
  select * into target
  from public.care_schedules where id = p_schedule_id;

  if target.id is null then
    raise exception 'Care schedule not found';
  end if;

  if not public.is_active_owner(target.farm_id, current_user_id) then
    raise exception 'Only active owners can assign schedule tasks';
  end if;

  if target.is_cancelled then
    raise exception 'Cancelled schedule cannot be assigned';
  end if;

  if not public.is_active_worker(target.farm_id, p_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  if exists (
    select 1 from public.care_tasks where care_schedule_id = p_schedule_id
  ) then
    raise exception 'Schedule already has a task';
  end if;

  insert into public.care_tasks (
    farm_id, care_schedule_id, assigned_to, assigned_by, title, category,
    instruction, target_type, target_tree_id,
    custom_target_note, due_date, requires_photo
  ) values (
    target.farm_id, target.id, p_worker_id, current_user_id,
    target.title, target.category, target.instruction,
    target.target_type, target.target_tree_id,
    target.custom_target_note, target.scheduled_date, target.requires_photo
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

-- 6d. create_next_recurring_schedule -- fungsi trigger tanpa parameter.
-- Sama seperti 046: SELURUH logika rantai, penjaga idempoten, perhitungan
-- tanggal WIB, dan blok exception dipertahankan verbatim. Yang berubah hanya
-- daftar kolom pada kedua INSERT.
create or replace function public.create_next_recurring_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent          public.care_schedules%rowtype;
  source_task     public.care_tasks%rowtype;
  chain_series_id uuid;
  active_owner_id uuid;
  next_date       date;
  new_schedule_id uuid;
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;

  if new.care_task_id is null then
    return new;
  end if;

  select * into source_task
  from public.care_tasks
  where id = new.care_task_id;

  if source_task.id is null or source_task.care_schedule_id is null then
    return new;
  end if;

  select * into parent
  from public.care_schedules
  where id = source_task.care_schedule_id;

  if parent.id is null
     or parent.repeat_every_days is null
     or parent.is_cancelled then
    return new;
  end if;

  chain_series_id := coalesce(parent.series_id, parent.id);

  -- Penjaga satu-jadwal-terbuka-per-rantai. Mencegah rantai bercabang kalau
  -- ada dua jadwal dalam satu seri yang entah bagaimana sama-sama terbuka.
  if exists (
    select 1
    from public.care_schedules s
    left join public.care_tasks t on t.care_schedule_id = s.id
    where s.series_id = chain_series_id
      and s.id <> parent.id
      and s.is_cancelled = false
      and (t.id is null or t.status <> 'completed')
  ) then
    return new;
  end if;

  -- Penjaga idempoten: kalau penerus sudah pernah dibuat, berhenti.
  if exists (
    select 1 from public.care_schedules
    where parent_schedule_id = parent.id
  ) then
    return new;
  end if;

  -- validate_care_schedule() dan validate_care_task() mewajibkan
  -- created_by / assigned_by adalah owner yang masih aktif.
  -- Prioritaskan owner pembuat jadwal induk; kalau sudah tidak aktif,
  -- pakai owner aktif mana pun di kebun itu.
  select fm.user_id into active_owner_id
  from public.farm_members fm
  where fm.farm_id = parent.farm_id
    and fm.role = 'owner'
    and fm.status = 'active'
  order by (fm.user_id = parent.created_by) desc, fm.user_id
  limit 1;

  if active_owner_id is null then
    return new;
  end if;

  -- Tanggal berikutnya dihitung dari TANGGAL SELESAI, bukan tanggal jadwal.
  -- performed_at bertipe timestamptz sementara scheduled_date bertipe date,
  -- jadi konversi zona waktu harus eksplisit -- tanpa ini, tugas yang selesai
  -- jam 8 malam WIB akan terhitung sebagai hari sebelumnya.
  next_date := (new.performed_at at time zone 'Asia/Jakarta')::date
               + parent.repeat_every_days;

  insert into public.care_schedules (
    farm_id, title, category, scheduled_date,
    target_type, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    parent.farm_id, parent.title, parent.category, next_date,
    parent.target_type, parent.target_tree_id, parent.custom_target_note,
    parent.instruction, parent.requires_photo, active_owner_id,
    parent.repeat_every_days, chain_series_id, parent.id
  )
  returning id into new_schedule_id;

  -- Tugas HANYA dibuat kalau pekerjanya masih aktif di kebun.
  -- care_tasks.assigned_to bertipe NOT NULL sehingga "tugas tanpa pekerja"
  -- mustahil; yang mungkin adalah JADWAL tanpa tugas. Owner menugaskan
  -- ulang lewat assign_worker_to_care_schedule().
  if public.is_active_worker(parent.farm_id, source_task.assigned_to) then
    insert into public.care_tasks (
      farm_id, care_schedule_id, assigned_to, assigned_by,
      title, category, instruction,
      target_type, target_tree_id,
      custom_target_note, due_date, requires_photo
    ) values (
      parent.farm_id, new_schedule_id, source_task.assigned_to, active_owner_id,
      parent.title, parent.category, parent.instruction,
      parent.target_type, parent.target_tree_id,
      parent.custom_target_note, next_date, parent.requires_photo
    );
  end if;

  return new;

exception
  when others then
    -- Jaring pengaman terakhir. Rantai gagal tidak boleh menggagalkan
    -- penyelesaian tugas pekerja.
    raise warning 'Rantai jadwal gagal untuk task %: %', new.care_task_id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.create_next_recurring_schedule() from public, anon;

-- ===========================================================================
-- 7. Muat ulang cache schema PostgREST
--    Dua signature RPC berubah; tanpa ini klien memanggil bentuk lama dan
--    kena PGRST202.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom target_row / target_column hilang dari KEDUA tabel -- harus 0 baris:
--
--      select table_name, column_name
--      from information_schema.columns
--      where table_schema = 'public'
--        and table_name in ('care_schedules', 'care_tasks')
--        and column_name in ('target_row', 'target_column');
--
-- 2. Keempat constraint terpasang dan tervalidasi -- harus 4 baris,
--    convalidated true semua. Kalau *_target_check TIDAK muncul, berarti
--    drop column membuangnya dan add gagal. STOP, jangan lanjut:
--
--      select conrelid::regclass as tabel, conname, convalidated
--      from pg_constraint
--      where conrelid in ('public.care_schedules'::regclass,
--                         'public.care_tasks'::regclass)
--        and conname like '%target%'
--      order by 1, 2;
--
-- 3. care_tasks.category sudah NOT NULL:
--
--      select is_nullable from information_schema.columns
--      where table_schema = 'public' and table_name = 'care_tasks'
--        and column_name = 'category';
--    -> harus 'NO'
--
-- 4. Dua RPC TIDAK ter-overload -- masing-masing harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('create_manual_schedule',
--                          'create_task_from_operational_report')
--      order by 1;
--
--    -> kalau salah satu muncul dua kali, drop-nya gagal dan PostgREST bisa
--       memilih signature lama. STOP.
--
-- 5. Grant execute menempel pada kedua RPC yang di-drop-and-create:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('create_manual_schedule',
--                             'create_task_from_operational_report');
--
-- 6. validate_care_sop() sudah hilang -- harus 0 baris:
--
--      select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'validate_care_sop';
--
-- 7. Nilai enum 'row'/'column' memang masih ada di katalog (DISENGAJA), tapi
--    tertolak oleh CHECK. Uji langsung -- insert di bawah HARUS gagal dengan
--    care_schedules_target_type_allowed_check:
--
--      insert into public.care_schedules
--        (farm_id, title, category, scheduled_date, target_type, created_by)
--      values
--        ('<farm uuid>', 'uji row', 'watering', current_date, 'row', '<owner uuid>');
--
-- 8. Alur nyata, bukan hanya katalog: buat jadwal manual berulang bertarget
--    pohon lewat aplikasi, selesaikan tugasnya, pastikan jadwal penerus lahir.
--    create_next_recurring_schedule() menelan exception-nya sendiri, jadi
--    rantai yang rusak TIDAK muncul sebagai error di aplikasi. Cek log Postgres
--    untuk 'Rantai jadwal gagal untuk task'.
-- ===========================================================================
