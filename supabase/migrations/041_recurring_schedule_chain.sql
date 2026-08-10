-- 041_recurring_schedule_chain.sql
--
-- Mesin rantai jadwal berulang.
--
-- ATURAN PALING PENTING DI FILE INI:
--   Trigger rantai TIDAK BOLEH PERNAH raise exception.
--
--   Trigger ini berjalan di dalam transaksi milik PEKERJA saat dia menekan
--   "Selesai". Kalau trigger meledak, seluruh transaksi rollback dan pekerja
--   melihat "gagal menyelesaikan tugas" untuk pekerjaan yang sudah benar-benar
--   dia lakukan. Penyelesaian tugas adalah data primer; pembuatan jadwal
--   berikutnya adalah kenyamanan sekunder. Kalau rantai gagal, dia berhenti
--   diam-diam dan owner menugaskan ulang secara manual.
--
-- Konteks otorisasi:
--   - RLS INSERT pada care_schedules/care_tasks adalah owner-only. Fungsi
--     SECURITY DEFINER ini berjalan sebagai pemilik tabel sehingga melewati
--     RLS (tabel tidak memakai FORCE ROW LEVEL SECURITY).
--   - Yang TIDAK bisa dilewati adalah trigger validate_care_schedule() dan
--     validate_care_task(), yang raise exception tanpa peduli role. Karena
--     itu created_by/assigned_by wajib diisi uuid owner yang masih aktif,
--     dan assigned_to wajib pekerja yang masih aktif.

-- ---------------------------------------------------------------------------
-- 1. Fungsi rantai
-- ---------------------------------------------------------------------------

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
    farm_id, care_sop_id, title, category, scheduled_date,
    target_type, target_row, target_column, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    parent.farm_id, null, parent.title, parent.category, next_date,
    parent.target_type, parent.target_row, parent.target_column,
    parent.target_tree_id, parent.custom_target_note,
    parent.instruction, parent.requires_photo, active_owner_id,
    parent.repeat_every_days, chain_series_id, parent.id
  )
  returning id into new_schedule_id;

  -- Tugas HANYA dibuat kalau pekerjanya masih aktif di kebun.
  -- care_tasks.assigned_to bertipe NOT NULL sehingga "tugas tanpa pekerja"
  -- mustahil; yang mungkin adalah JADWAL tanpa tugas. Owner menugaskan
  -- ulang lewat assign_worker_to_care_schedule() di bawah.
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

-- Nama trigger diawali "zz_" agar dijalankan setelah
-- sync_task_status_from_activity_trigger (PostgreSQL memicu trigger
-- berdasarkan urutan nama).
drop trigger if exists zz_create_next_recurring_schedule_trigger
  on public.care_activities;

create trigger zz_create_next_recurring_schedule_trigger
  after insert on public.care_activities
  for each row
  execute function public.create_next_recurring_schedule();

-- ---------------------------------------------------------------------------
-- 2. Pembersih penerus yatim
--
-- rollback_completed_task_activity() menghapus baris care_activities kalau
-- upload foto bukti gagal. Kalau rantai sudah terlanjur membuat penerus,
-- penerus itu harus ikut dibatalkan -- kalau tidak, rantai punya dua jadwal
-- terbuka sekaligus.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_orphan_recurring_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_task  public.care_tasks%rowtype;
  successor_id uuid;
begin
  if old.status is distinct from 'completed' or old.care_task_id is null then
    return old;
  end if;

  select * into source_task
  from public.care_tasks where id = old.care_task_id;

  if source_task.id is null or source_task.care_schedule_id is null then
    return old;
  end if;

  select s.id into successor_id
  from public.care_schedules s
  where s.parent_schedule_id = source_task.care_schedule_id
    and not exists (
      select 1
      from public.care_tasks t
      join public.care_activities a on a.care_task_id = t.id
      where t.care_schedule_id = s.id
    )
  limit 1;

  if successor_id is null then
    return old;
  end if;

  delete from public.care_tasks where care_schedule_id = successor_id;
  delete from public.care_schedules where id = successor_id;

  return old;

exception
  when others then
    raise warning 'Pembersihan penerus rantai gagal untuk task %: %',
      old.care_task_id, sqlerrm;
    return old;
end;
$$;

revoke all on function public.cleanup_orphan_recurring_schedule() from public, anon;

drop trigger if exists zz_cleanup_orphan_recurring_schedule_trigger
  on public.care_activities;

create trigger zz_cleanup_orphan_recurring_schedule_trigger
  after delete on public.care_activities
  for each row
  execute function public.cleanup_orphan_recurring_schedule();

-- ---------------------------------------------------------------------------
-- 3. create_manual_schedule -- tambah parameter pengulangan
--
-- Signature berubah, jadi fungsi lama harus di-drop lebih dulu; create or
-- replace hanya akan membuat overload baru.
-- ---------------------------------------------------------------------------

drop function if exists public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean
);

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
    id, farm_id, care_sop_id, title, category, scheduled_date, target_type,
    target_row, target_column, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id
  ) values (
    new_schedule_id, p_farm_id, null, p_title, p_category, p_scheduled_date,
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

revoke all on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean, integer
) from public, anon;

grant execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  text, text, uuid, text, text, boolean, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Menugaskan pekerja ke jadwal yang belum punya tugas
--
-- State baru yang sebelumnya tidak pernah ada: jadwal tanpa tugas. Terjadi
-- kalau pekerja rantai sudah keluar dari kebun saat penerus dibuat.
-- ---------------------------------------------------------------------------

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
    instruction, target_type, target_row, target_column, target_tree_id,
    custom_target_note, due_date, requires_photo
  ) values (
    target.farm_id, target.id, p_worker_id, current_user_id,
    target.title, target.category, target.instruction,
    target.target_type, target.target_row, target.target_column,
    target.target_tree_id, target.custom_target_note,
    target.scheduled_date, target.requires_photo
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

revoke all on function public.assign_worker_to_care_schedule(uuid, uuid)
  from public, anon;
grant execute on function public.assign_worker_to_care_schedule(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Menghentikan pengulangan tanpa membatalkan jadwal berjalan
--
-- Berbeda dari cancel_care_schedule(): yang ini membiarkan jadwal sekarang
-- tetap dikerjakan, hanya menghentikan kelanjutan rantainya.
-- ---------------------------------------------------------------------------

create or replace function public.stop_care_schedule_repeat(
  p_schedule_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target public.care_schedules%rowtype;
begin
  select * into target
  from public.care_schedules where id = p_schedule_id;

  if target.id is null then
    raise exception 'Care schedule not found';
  end if;

  if not public.is_active_owner(target.farm_id, current_user_id) then
    raise exception 'Only active owners can stop schedule repetition';
  end if;

  if target.repeat_every_days is null then
    raise exception 'Care schedule is not recurring';
  end if;

  update public.care_schedules
  set repeat_every_days = null, updated_at = now()
  where id = p_schedule_id;
end;
$$;

revoke all on function public.stop_care_schedule_repeat(uuid) from public, anon;
grant execute on function public.stop_care_schedule_repeat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFIKASI SETELAH MIGRASI
--
-- 1. Trigger terpasang dan urutannya benar (zz_ harus di bawah sync_):
--
--    select t.tgname
--    from pg_trigger t join pg_class c on c.oid = t.tgrelid
--    where c.relname = 'care_activities' and not t.tgisinternal
--    order by t.tgname;
--
-- 2. Signature create_manual_schedule tinggal satu (tidak ada overload):
--
--    select p.oid::regprocedure
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'create_manual_schedule';
--
-- 3. Rantai terputus -- harus 0 sebelum uji coba, dan dipakai layar Jadwal
--    owner untuk memunculkan peringatan:
--
--    select s.id, s.title, s.scheduled_date
--    from public.care_schedules s
--    join public.care_tasks t on t.care_schedule_id = s.id
--    where s.repeat_every_days is not null
--      and s.is_cancelled = false
--      and t.status = 'completed'
--      and not exists (
--        select 1 from public.care_schedules n
--        where n.parent_schedule_id = s.id
--      );
--
-- 4. Rantai bercabang -- harus selalu 0:
--
--    select series_id, count(*)
--    from public.care_schedules s
--    where series_id is not null and is_cancelled = false
--      and not exists (
--        select 1 from public.care_tasks t
--        where t.care_schedule_id = s.id and t.status = 'completed'
--      )
--    group by series_id having count(*) > 1;
-- ---------------------------------------------------------------------------
