-- 046_drop_care_sops.sql
--
-- Melepas care_sops dari database. Fitur SOP sudah dilepas dari aplikasi sejak
-- lama (lihat src/constants/careCategory.ts); migrasi ini membuang jejaknya di
-- DB: tabel, RPC, policy, trigger, index, dan kolom care_schedules.care_sop_id.
--
-- PRASYARAT: data transaksional care_* sudah dikosongkan manual. Migrasi ini
-- tidak memigrasikan data apa pun.
--
-- URUTAN WAJIB — bagian 1 SEBELUM bagian 2:
--   validate_care_schedule() dan validate_care_task() adalah trigger
--   BEFORE INSERT OR UPDATE pada care_schedules dan care_tasks, dan keduanya
--   membaca care_sops / care_sop_id. create_manual_schedule() dan
--   create_next_recurring_schedule() menyebut care_sop_id di daftar kolom
--   INSERT mereka. Kalau tabel/kolomnya dibuang lebih dulu, keempatnya gagal:
--   pembuatan jadwal dan tugas mati, dan rantai jadwal berulang putus DIAM-DIAM
--   karena trigger rantai menelan exception-nya (041:150-155).
--
--   CASCADE tidak menolong. PostgreSQL tidak melacak dependensi badan fungsi
--   plpgsql ke tabel, jadi drop tidak akan memperingatkan apa pun dan keempat
--   fungsi itu baru meledak saat dipanggil.
--
-- Yang SENGAJA TIDAK disentuh di sini (migrasi berikutnya): target_row,
-- target_column, category, task_status, postpone_task, complete_task, dan
-- segala hal soal keanggotaan.

begin;

-- ===========================================================================
-- 1. Definisi ulang fungsi yang membaca care_sops / care_sop_id
--    Semua validasi lain dipertahankan PERSIS seperti sebelumnya.
-- ===========================================================================

-- 1a. validate_care_schedule() — asal 006:229.
-- Dibuang: blok pemeriksaan kesamaan farm antara jadwal dan SOP induknya
-- (006:239-247) berikut variabel sop_farm_id. Pemeriksaan pohon dan penjaga
-- "hanya owner aktif" tidak berubah.
create or replace function public.validate_care_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tree_farm_id uuid;
begin
  if new.target_type = 'tree' then
    select farm_id into tree_farm_id
    from public.trees
    where id = new.target_tree_id;

    if tree_farm_id is distinct from new.farm_id then
      raise exception 'Care schedule target tree must belong to the same farm';
    end if;
  end if;

  if not exists (
    select 1
    from public.farm_members
    where farm_id = new.farm_id
      and user_id = new.created_by
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only active owners can manage care schedules';
  end if;

  return new;
end;
$$;

-- 1b. validate_care_task() — asal 006:274.
-- Dibuang: pembacaan care_sop_id (006:287) berikut variabel schedule_from_sop,
-- dan aturan "tugas dari jadwal SOP tidak boleh target custom" (006:317-319).
--
-- DIPERTAHANKAN: penjaga pekerja aktif (006:321-330). Itu satu-satunya
-- penegakan yang efektif untuk assigned_to — RLS INSERT care_tasks di-bypass
-- oleh seluruh RPC SECURITY DEFINER yang menulis ke tabel ini, sedangkan
-- trigger ini raise tanpa peduli role pemanggil. Penjaga owner aktif untuk
-- assigned_by (006:332-341) juga dipertahankan apa adanya.
create or replace function public.validate_care_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_farm_id uuid;
  report_farm_id uuid;
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

  if new.operational_report_id is not null then
    select farm_id into report_farm_id
    from public.operational_reports
    where id = new.operational_report_id;

    if report_farm_id is distinct from new.farm_id then
      raise exception 'Care task operational report must belong to the same farm';
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

-- 1c. create_next_recurring_schedule() — asal 041:28.
-- Satu-satunya perubahan: care_sop_id dibuang dari daftar kolom INSERT dan
-- `null` yang berpasangan dengannya dibuang dari daftar VALUES. Seluruh logika
-- rantai, penjaga idempoten, perhitungan tanggal WIB, dan blok exception
-- dipertahankan verbatim.
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
    target_type, target_row, target_column, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    parent.farm_id, parent.title, parent.category, next_date,
    parent.target_type, parent.target_row, parent.target_column,
    parent.target_tree_id, parent.custom_target_note,
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
      target_type, target_row, target_column, target_tree_id,
      custom_target_note, due_date, requires_photo
    ) values (
      parent.farm_id, new_schedule_id, source_task.assigned_to, active_owner_id,
      parent.title, parent.category, parent.instruction,
      parent.target_type, parent.target_row, parent.target_column,
      parent.target_tree_id, parent.custom_target_note,
      next_date, parent.requires_photo
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

-- 1d. create_manual_schedule() — asal 041:252.
-- Signature TIDAK berubah (13 parameter yang sama, urutan sama), jadi
-- `create or replace` sudah cukup dan tidak ada overload baru yang tercipta.
-- Karena tidak di-drop, grant execute yang sudah menempel tetap utuh; revoke/
-- grant di bawah ditulis ulang sebagai penegasan, bukan perbaikan.
-- Satu-satunya perubahan isi: care_sop_id dibuang dari daftar kolom INSERT
-- dan `null` pasangannya dibuang dari daftar VALUES.
create or replace function public.create_manual_schedule(
  p_farm_id uuid,
  p_title text,
  p_category public.care_category,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_row text default null,
  p_target_column text default null,
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
    target_row, target_column, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    new_schedule_id, p_farm_id, p_title, p_category, p_scheduled_date,
    p_target_type, p_target_row, p_target_column, p_target_tree_id,
    p_custom_target_note, p_instruction, coalesce(p_requires_photo, false),
    current_user_id,
    repeat_days,
    case when repeat_days is null then null else new_schedule_id end,
    null
  );

  insert into public.care_tasks (
    farm_id, care_schedule_id, assigned_to, assigned_by, title, category,
    instruction, target_type, target_row, target_column, target_tree_id,
    custom_target_note, due_date, requires_photo
  ) values (
    p_farm_id, new_schedule_id, p_assigned_worker_id, current_user_id,
    p_title, p_category, p_instruction, p_target_type, p_target_row,
    p_target_column, p_target_tree_id, p_custom_target_note,
    p_scheduled_date, coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id;
end;
$$;

revoke execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean, integer
) from public, anon;

grant execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean, integer
) to authenticated;

-- ===========================================================================
-- 2. Pembongkaran objek SOP
--    Aman dijalankan HANYA setelah bagian 1 selesai.
-- ===========================================================================

-- 2a. Trigger pada care_sops.
-- Redundan secara teknis (drop table ikut membuang trigger-nya), ditulis
-- eksplisit supaya urutan pembongkaran terbaca dari berkas ini saja.
drop trigger if exists set_care_sops_updated_at on public.care_sops;
drop trigger if exists validate_care_sop_trigger on public.care_sops;

-- 2b. Index care_sops (006:28).
drop index if exists public.idx_care_sops_farm_active;

-- 2c. RLS policy care_sops (007:206-232) dan grant tabelnya (007:354).
drop policy if exists "Active members can view care sops" on public.care_sops;
drop policy if exists "Active owner can insert care sops" on public.care_sops;
drop policy if exists "Active owner can update care sops" on public.care_sops;

revoke select, insert, update on public.care_sops from authenticated;

-- 2d. RPC create_schedule_from_sop.
-- Signature yang aktif adalah versi 10 parameter dari 018:62 (versi 9 parameter
-- dari 008:381 sudah di-drop oleh 016:98 dan 018:23). Grant execute ikut hilang
-- bersama fungsinya.
drop function if exists public.create_schedule_from_sop(
  uuid,
  uuid,
  date,
  uuid,
  public.target_type,
  text,
  text,
  uuid,
  text,
  boolean
);

-- 2e. Kolom care_schedules.care_sop_id berikut FK dan constraint yang menyebutnya.
--
-- URUTAN PENTING: constraint di-drop MANUAL lebih dulu, baru kolomnya, baru
-- constraint dipasang ulang. Kalau kolomnya di-drop duluan, PostgreSQL ikut
-- membuang care_schedules_target_check secara otomatis karena constraint itu
-- merujuk kolom tersebut -- dan SELURUH validasi target jadwal hilang tanpa
-- satu pun pesan. Yang berubah pada definisi barunya HANYA hilangnya klausa
-- `care_sop_id is null` di cabang 'custom'; kelima cabang lain, termasuk
-- 'row' dan 'column', disalin apa adanya.
--
-- FK care_schedules_care_sop_id_fkey (dibuat inline di 004:51) ikut terbuang
-- bersama kolomnya, jadi tidak perlu disebut terpisah.
alter table public.care_schedules
  drop constraint if exists care_schedules_target_check;

alter table public.care_schedules
  drop column if exists care_sop_id;

alter table public.care_schedules
  add constraint care_schedules_target_check
  check (
    (
      target_type = 'farm'
      and target_row is null
      and target_column is null
      and target_tree_id is null
      and custom_target_note is null
    )
    or (
      target_type = 'row'
      and target_row is not null
      and target_column is null
      and target_tree_id is null
      and custom_target_note is null
    )
    or (
      target_type = 'column'
      and target_row is null
      and target_column is not null
      and target_tree_id is null
      and custom_target_note is null
    )
    or (
      target_type = 'tree'
      and target_row is null
      and target_column is null
      and target_tree_id is not null
      and custom_target_note is null
    )
    or (
      target_type = 'custom'
      and target_row is null
      and target_column is null
      and target_tree_id is null
      and custom_target_note is not null
    )
  );

-- 2f. Tabel care_sops.
drop table if exists public.care_sops;

-- ===========================================================================
-- 3. Tabel snapshot sisa migrasi 031
--    Dibuat manual lewat SQL Editor, tidak pernah lewat migrasi, jadi
--    `if exists` bukan sekadar formalitas. Lihat catatan penutup 031:161-162.
-- ===========================================================================

drop table if exists public._backup_031_manual_care_photos;
drop table if exists public._backup_031_manual_care_records;
drop table if exists public._backup_031_photo_attachments_removed;

-- Signature RPC berubah (create_schedule_from_sop hilang), jadi cache schema
-- PostgREST wajib dimuat ulang.
notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. care_sops dan tabel snapshot benar-benar hilang -- harus 0 baris:
--
--      select tablename from pg_tables
--      where schemaname = 'public'
--        and (tablename = 'care_sops' or tablename like '\_backup\_031\_%');
--
-- 2. Kolom care_sop_id hilang -- harus 0 baris:
--
--      select column_name from information_schema.columns
--      where table_schema = 'public' and table_name = 'care_schedules'
--        and column_name = 'care_sop_id';
--
-- 3. care_schedules_target_check terpasang ULANG dan tervalidasi.
--    convalidated harus true; kalau constraint-nya tidak muncul sama sekali,
--    berarti drop kolom membuangnya dan add gagal -- STOP, jangan lanjut:
--
--      select conname, convalidated from pg_constraint
--      where conrelid = 'public.care_schedules'::regclass
--        and conname = 'care_schedules_target_check';
--
-- 4. Tidak ada fungsi tersisa yang menyebut care_sop -- harus 0 baris:
--
--      select p.proname from pg_proc p
--      join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.prosrc ilike '%care_sop%';
--
--    Catatan: validate_care_sop() SENGAJA dibiarkan hidup (lihat di bawah),
--    jadi kueri ini akan mengembalikan fungsi itu satu baris. Selain itu
--    harus kosong.
--
-- 5. Keempat fungsi bagian 1 masih bisa dipanggil. Uji jalur nyata, bukan
--    hanya keberadaannya: buat satu jadwal manual berulang lewat aplikasi,
--    selesaikan tugasnya, lalu pastikan jadwal penerus terbentuk.
--    Kalau rantai diam-diam tidak lahir, create_next_recurring_schedule()
--    masih rusak -- exception-nya ditelan dan TIDAK akan muncul sebagai error
--    di aplikasi. Cek log Postgres untuk 'Rantai jadwal gagal untuk task'.
--
-- 6. Grant create_manual_schedule masih menempel:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'create_manual_schedule';
--
-- CATATAN — fungsi yatim yang SENGAJA dibiarkan:
--   public.validate_care_sop() masih ada. Trigger satu-satunya yang
--   memanggilnya (validate_care_sop_trigger) sudah dibuang di 2a, jadi fungsi
--   itu tidak akan pernah dieksekusi dan badannya yang merujuk care_sops tidak
--   berbahaya. Tidak ikut di-drop karena tidak disebut dalam lingkup migrasi
--   ini. Kandidat pembersihan di migrasi lanjutan.
-- ===========================================================================
