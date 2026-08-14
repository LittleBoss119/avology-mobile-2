-- 048_grace_period_and_missed_sweep.sql
--
-- Masa toleransi keterlambatan, dan rantai berulang yang tetap berjalan
-- meski satu siklus terlewat.
--
-- PRASYARAT: 046 dan 047 sudah dijalankan dan terverifikasi. Seluruh tabel
-- care_* kosong, jadi tidak ada backfill di migrasi ini.
--
-- Tiga hal baru:
--   1. `grace_days` pada jadwal. NULL = jadwal ini tidak pernah bisa terlewat.
--   2. `date_basis` pada jadwal: penerus dihitung dari tanggal JADWAL atau dari
--      tanggal REALISASI.
--   3. `missed_at` pada tugas DAN pada jadwal, diisi penyapu.
--
-- Logika pembuatan penerus DIANGKAT dari trigger menjadi fungsi tersendiri
-- (create_successor_schedule) supaya trigger dan penyapu memakai satu salinan
-- yang sama. Tidak boleh ada dua implementasi rantai.
--
-- Yang SENGAJA TIDAK disentuh (migrasi 049-051): postpone_task, complete_task,
-- care_activity_trees, dan segala hal soal keanggotaan.

begin;

-- ===========================================================================
-- 1. Kolom baru pada care_schedules
-- ===========================================================================

alter table public.care_schedules
  add column if not exists grace_days integer,
  add column if not exists date_basis text not null default 'jadwal',
  add column if not exists missed_at timestamptz;

comment on column public.care_schedules.grace_days is
  'Masa toleransi keterlambatan dalam hari. NULL = jadwal ini tidak pernah dinyatakan terlewat.';
comment on column public.care_schedules.date_basis is
  'Dasar perhitungan tanggal penerus: ''jadwal'' (scheduled_date) atau ''realisasi'' (performed_at).';
comment on column public.care_schedules.missed_at is
  'Kapan siklus jadwal ini dinyatakan terlewat oleh sweep_missed_schedules. NULL = belum terlewat.';

alter table public.care_schedules
  drop constraint if exists care_schedules_date_basis_check;

alter table public.care_schedules
  add constraint care_schedules_date_basis_check
  check (date_basis in ('jadwal', 'realisasi'));

-- 0 hari berarti "terlewat begitu lewat tanggalnya" -- sah dan berguna.
-- Negatif tidak punya arti dan hanya bisa muncul dari salah ketik.
alter table public.care_schedules
  drop constraint if exists care_schedules_grace_days_check;

alter table public.care_schedules
  add constraint care_schedules_grace_days_check
  check (grace_days is null or grace_days >= 0);

-- ===========================================================================
-- 2. Kolom baru pada care_tasks
-- ===========================================================================

alter table public.care_tasks
  add column if not exists missed_at timestamptz;

comment on column public.care_tasks.missed_at is
  'Kapan tugas ini dinyatakan terlewat oleh sweep_missed_schedules. NULL = belum terlewat. Tugas dari laporan operasional TIDAK PERNAH diisi.';

-- Dipakai penyapu untuk menemukan tugas yang masih terbuka dan belum ditandai.
create index if not exists idx_care_tasks_open_not_missed
  on public.care_tasks (farm_id, due_date)
  where missed_at is null and status in ('pending', 'postponed');

-- ===========================================================================
-- 3. create_successor_schedule -- satu-satunya implementasi rantai
--
-- Dipanggil dua pihak:
--   * trigger create_next_recurring_schedule(), saat tugas diselesaikan
--   * sweep_missed_schedules(), saat satu siklus dinyatakan terlewat
--
-- ATURAN PALING PENTING, diwarisi dari 041: fungsi ini TIDAK BOLEH PERNAH
-- raise. Ia berjalan di dalam transaksi milik PEKERJA saat menekan "Selesai".
-- Kalau meledak, seluruh transaksi rollback dan pekerja melihat "gagal
-- menyelesaikan tugas" untuk pekerjaan yang sudah benar-benar dia lakukan.
--
-- p_performed_at diperlukan karena cabang date_basis='realisasi' menghitung
-- dari waktu realisasi, dan waktu itu hanya diketahui pemanggil. Trigger
-- mengirim NEW.performed_at; penyapu mengirim NULL karena pada siklus yang
-- terlewat realisasinya memang tidak pernah terjadi -- di situ perhitungan
-- jatuh kembali ke basis jadwal.
-- ===========================================================================

create or replace function public.create_successor_schedule(
  p_schedule_id uuid,
  p_performed_at timestamptz default null
)
returns uuid
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
  today_wib       date;
  new_schedule_id uuid;
  step_guard      integer := 0;
begin
  select * into parent
  from public.care_schedules
  where id = p_schedule_id;

  if parent.id is null
     or parent.repeat_every_days is null
     or parent.is_cancelled then
    return null;
  end if;

  chain_series_id := coalesce(parent.series_id, parent.id);

  -- Penjaga satu-jadwal-terbuka-per-rantai. Mencegah rantai bercabang kalau
  -- ada dua jadwal dalam satu seri yang sama-sama terbuka.
  --
  -- DIPERLUAS di migrasi ini. Versi 041 berbunyi
  --   (t.id is null or t.status <> 'completed')
  -- yang menghitung tugas terlewat DAN jadwal tanpa tugas sebagai selamanya
  -- terbuka. Akibatnya rantai mandek permanen setelah tepat satu siklus
  -- terlewat -- justru kasus yang penyapu ini dibuat untuk menangani.
  --
  -- Sekarang sebuah jadwal dianggap masih terbuka hanya bila:
  --   * belum dibatalkan, DAN
  --   * belum dinyatakan terlewat (s.missed_at is null), DAN
  --   * tugasnya belum selesai dan belum terlewat, ATAU belum punya tugas.
  if exists (
    select 1
    from public.care_schedules s
    left join public.care_tasks t on t.care_schedule_id = s.id
    where s.series_id = chain_series_id
      and s.id <> parent.id
      and s.is_cancelled = false
      and s.missed_at is null
      and (
        t.id is null
        or (t.status <> 'completed' and t.missed_at is null)
      )
  ) then
    return null;
  end if;

  -- Penjaga idempoten: kalau penerus sudah pernah dibuat, berhenti.
  -- Inilah yang membuat penyapu aman dipanggil berulang kali, dan yang
  -- mencegah penerus ganda kalau tugas yang sudah terlewat akhirnya
  -- diselesaikan pekerja.
  if exists (
    select 1 from public.care_schedules
    where parent_schedule_id = parent.id
  ) then
    return null;
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
    return null;
  end if;

  today_wib := (now() at time zone 'Asia/Jakarta')::date;

  if parent.date_basis = 'realisasi' and p_performed_at is not null then
    -- Perilaku 041:112. performed_at bertipe timestamptz sementara
    -- scheduled_date bertipe date, jadi konversi zona waktu harus eksplisit --
    -- tanpa ini, tugas yang selesai jam 8 malam WIB akan terhitung sebagai
    -- hari sebelumnya.
    next_date := (p_performed_at at time zone 'Asia/Jakarta')::date
                 + parent.repeat_every_days;
  else
    -- Basis jadwal, dan juga cabang penyapu untuk date_basis='realisasi':
    -- pada siklus yang terlewat tidak ada realisasi untuk dijadikan patokan.
    --
    -- Dimajukan berulang sampai melewati hari ini supaya penerus tidak lahir
    -- dalam keadaan sudah terlambat. step_guard hanya pagar terhadap loop tak
    -- berujung; repeat_every_days sudah dijamin > 0 oleh
    -- care_schedules_repeat_every_days_check, jadi pagar ini seharusnya tidak
    -- pernah tersentuh.
    next_date := parent.scheduled_date + parent.repeat_every_days;

    while next_date <= today_wib and step_guard < 1000 loop
      next_date := next_date + parent.repeat_every_days;
      step_guard := step_guard + 1;
    end loop;
  end if;

  -- grace_days dan date_basis diwariskan; missed_at TIDAK -- penerus lahir
  -- bersih.
  insert into public.care_schedules (
    farm_id, title, category, scheduled_date,
    target_type, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id,
    grace_days, date_basis
  ) values (
    parent.farm_id, parent.title, parent.category, next_date,
    parent.target_type, parent.target_tree_id, parent.custom_target_note,
    parent.instruction, parent.requires_photo, active_owner_id,
    parent.repeat_every_days, chain_series_id, parent.id,
    parent.grace_days, parent.date_basis
  )
  returning id into new_schedule_id;

  -- Pekerja penerus diambil dari tugas induk. Jadwal induk boleh tidak punya
  -- tugas sama sekali (cabang 041:133 yang berulang), dan dalam hal itu
  -- penerus juga lahir tanpa tugas -- owner menugaskan lewat
  -- assign_worker_to_care_schedule().
  select * into source_task
  from public.care_tasks
  where care_schedule_id = parent.id
  order by created_at
  limit 1;

  -- Tugas HANYA dibuat kalau pekerjanya masih aktif di kebun.
  -- care_tasks.assigned_to bertipe NOT NULL sehingga "tugas tanpa pekerja"
  -- mustahil; yang mungkin adalah JADWAL tanpa tugas.
  if source_task.id is not null
     and public.is_active_worker(parent.farm_id, source_task.assigned_to) then
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

  return new_schedule_id;

exception
  when others then
    -- Jaring pengaman terakhir. Rantai gagal tidak boleh menggagalkan
    -- penyelesaian tugas pekerja maupun pembacaan daftar.
    raise warning 'Rantai jadwal gagal untuk jadwal %: %', p_schedule_id, sqlerrm;
    return null;
end;
$$;

revoke all on function public.create_successor_schedule(uuid, timestamptz)
  from public, anon;

-- ===========================================================================
-- 4. Trigger rantai -- sekarang hanya pembungkus tipis
--
-- Nama trigger dan urutannya TIDAK berubah: tetap zz_ agar berjalan setelah
-- sync_task_status_from_activity_trigger.
-- ===========================================================================

create or replace function public.create_next_recurring_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_task public.care_tasks%rowtype;
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

  perform public.create_successor_schedule(
    source_task.care_schedule_id,
    new.performed_at
  );

  return new;

exception
  when others then
    raise warning 'Rantai jadwal gagal untuk task %: %', new.care_task_id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.create_next_recurring_schedule() from public, anon;

-- ===========================================================================
-- 5. sweep_missed_schedules -- penyapu
--
-- Dipanggil dari jalur BACA aplikasi (daftar jadwal, daftar tugas, dashboard),
-- jadi ia harus murah, aman dijalankan bersamaan, dan tidak pernah menggagalkan
-- pembacaan.
--
-- Otorisasi: fungsi ini SECURITY DEFINER sehingga melewati RLS. Tanpa penjaga
-- keanggotaan, siapa pun yang sudah login bisa menjalankan penyapu pada kebun
-- orang lain. Penjaga di bawah menutup itu. Ia RETURN diam-diam alih-alih raise
-- karena dipanggil di jalur baca -- pemanggil yang tidak berhak cukup tidak
-- mendapat efek apa pun.
-- ===========================================================================

create or replace function public.sweep_missed_schedules(p_farm_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  target record;
begin
  if p_farm_id is null then
    return;
  end if;

  if not public.is_active_farm_member(p_farm_id, auth.uid()) then
    return;
  end if;

  -- Lock per kebun, dilepas otomatis di akhir transaksi. Kalau sudah ada
  -- penyapu lain yang berjalan untuk kebun ini, yang ini berhenti tanpa
  -- berbuat apa-apa: hasilnya akan sama, dan pembacaan tidak perlu menunggu.
  if not pg_try_advisory_xact_lock(hashtext(p_farm_id::text)) then
    return;
  end if;

  -- 5a. Tandai TUGAS yang sudah lewat masa toleransi.
  --
  -- Join ke care_schedules sekaligus menjadi penyaring: tugas dari laporan
  -- operasional punya care_schedule_id NULL sehingga tidak pernah ikut ter-join,
  -- dan karena itu TIDAK PERNAH ditandai terlewat.
  update public.care_tasks t
  set missed_at = now(),
      updated_at = now()
  from public.care_schedules s
  where t.care_schedule_id = s.id
    and t.farm_id = p_farm_id
    and t.status in ('pending', 'postponed')
    and t.missed_at is null
    and s.is_cancelled = false
    and s.grace_days is not null
    and (t.due_date + s.grace_days) < today_wib;

  -- 5b. Tandai JADWAL-nya.
  --
  -- Dua sumber:
  --   * jadwal yang tugasnya baru saja ditandai di 5a
  --   * jadwal berulang yang belum pernah punya tugas sama sekali (cabang
  --     041:133) dan sudah lewat masa toleransi dihitung dari scheduled_date
  --
  -- Penandaan di level jadwal inilah yang membuat penjaga
  -- satu-jadwal-terbuka-per-rantai di create_successor_schedule bisa maju:
  -- tanpa ini, jadwal tanpa tugas akan terhitung terbuka selamanya.
  update public.care_schedules s
  set missed_at = now(),
      updated_at = now()
  where s.farm_id = p_farm_id
    and s.missed_at is null
    and s.is_cancelled = false
    and s.grace_days is not null
    and (
      exists (
        select 1 from public.care_tasks t
        where t.care_schedule_id = s.id
          and t.missed_at is not null
      )
      or (
        not exists (
          select 1 from public.care_tasks t
          where t.care_schedule_id = s.id
        )
        and (s.scheduled_date + s.grace_days) < today_wib
      )
    );

  -- 5c. Lanjutkan rantai untuk setiap jadwal berulang yang sudah dinyatakan
  -- terlewat.
  --
  -- Sengaja memeriksa SELURUH jadwal terlewat, bukan hanya yang baru ditandai
  -- di atas: penjaga idempoten di create_successor_schedule membuat pemanggilan
  -- ulang tidak berbiaya, dan sebagai gantinya penyapu ini memperbaiki sendiri
  -- rantai yang penerusnya gagal lahir pada sapuan sebelumnya (misalnya karena
  -- saat itu tidak ada owner aktif).
  --
  -- Urut menaik menurut scheduled_date supaya rantai panjang yang tertinggal
  -- beberapa siklus dipulihkan dari yang paling tua.
  for target in
    select s.id
    from public.care_schedules s
    where s.farm_id = p_farm_id
      and s.repeat_every_days is not null
      and s.is_cancelled = false
      and s.missed_at is not null
    order by s.scheduled_date, s.created_at
  loop
    perform public.create_successor_schedule(target.id, null);
  end loop;
end;
$$;

revoke all on function public.sweep_missed_schedules(uuid) from public, anon;
grant execute on function public.sweep_missed_schedules(uuid) to authenticated;

-- ===========================================================================
-- 6. create_manual_schedule -- default grace_days per kategori
--
-- Signature berubah, jadi fungsi lama WAJIB di-drop lebih dulu. `create or
-- replace` dengan daftar parameter berbeda hanya membuat OVERLOAD baru, lalu
-- PostgREST menghadapi dua kandidat dan bisa memilih yang salah -- kelas bug
-- yang ditangani migrasi 024 dan diperingatkan ulang di 043:110-118 dan 047.
--
-- Ketiga parameter baru diletakkan di AKHIR dan semuanya berdefault, mengikuti
-- aturan PostgreSQL bahwa parameter tanpa default tidak boleh muncul setelah
-- parameter berdefault.
--
-- p_never_expires dan p_grace_days sengaja TIDAK saling menimpa diam-diam:
-- mengirim keduanya adalah tanda pemanggil bingung, dan lebih baik ketahuan
-- sebagai error daripada salah satunya dibuang tanpa jejak.
-- ===========================================================================

drop function if exists public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer
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
  p_repeat_every_days integer default null,
  p_grace_days integer default null,
  p_never_expires boolean default false,
  p_date_basis text default 'jadwal'
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
  final_grace_days integer;
begin
  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can create manual schedules';
  end if;

  if not public.is_active_worker(p_farm_id, p_assigned_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  if p_date_basis is null or p_date_basis not in ('jadwal', 'realisasi') then
    raise exception 'Dasar tanggal harus ''jadwal'' atau ''realisasi''.';
  end if;

  if coalesce(p_never_expires, false) and p_grace_days is not null then
    raise exception 'Pilih salah satu: p_never_expires atau p_grace_days, jangan keduanya.';
  end if;

  if p_grace_days is not null and p_grace_days < 0 then
    raise exception 'Masa toleransi tidak boleh negatif.';
  end if;

  -- Urutan penentuan masa toleransi:
  --   1. p_never_expires true  -> NULL, jadwal tidak pernah terlewat
  --   2. p_grace_days diisi    -> dipakai apa adanya
  --   3. keduanya kosong       -> default menurut kategori perawatan
  --
  -- Angka default berasal dari seberapa cepat pekerjaan itu kehilangan makna
  -- kalau tertunda: penyiraman basi dalam hitungan hari, pengendalian gulma
  -- masih berguna dua minggu kemudian. Kategori 'other' tidak punya default
  -- karena isinya bebas dan tidak bisa ditebak.
  if coalesce(p_never_expires, false) then
    final_grace_days := null;
  elsif p_grace_days is not null then
    final_grace_days := p_grace_days;
  else
    final_grace_days := case p_category
      when 'watering' then 2
      when 'spraying' then 5
      when 'fertilizing' then 10
      when 'weeding' then 14
      else null
    end;
  end if;

  repeat_days := nullif(greatest(coalesce(p_repeat_every_days, 0), 0), 0);

  new_schedule_id := gen_random_uuid();

  insert into public.care_schedules (
    id, farm_id, title, category, scheduled_date, target_type,
    target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id,
    grace_days, date_basis
  ) values (
    new_schedule_id, p_farm_id, p_title, p_category, p_scheduled_date,
    p_target_type, p_target_tree_id,
    p_custom_target_note, p_instruction, coalesce(p_requires_photo, false),
    current_user_id,
    repeat_days,
    case when repeat_days is null then null else new_schedule_id end,
    null,
    final_grace_days, p_date_basis
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
  uuid, text, text, boolean, integer, integer, boolean, text
) from public, anon;

grant execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer, integer, boolean, text
) to authenticated;

-- ===========================================================================
-- 7. Muat ulang cache schema PostgREST
--    Signature create_manual_schedule berubah dan dua RPC baru ditambahkan;
--    tanpa ini klien kena PGRST202.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom baru ada dengan sifat yang benar:
--
--      select table_name, column_name, is_nullable, column_default
--      from information_schema.columns
--      where table_schema = 'public'
--        and (
--          (table_name = 'care_schedules' and column_name in ('grace_days','date_basis','missed_at'))
--          or (table_name = 'care_tasks' and column_name = 'missed_at')
--        )
--      order by table_name, column_name;
--
--    -> date_basis harus NOT NULL dengan default 'jadwal'; tiga sisanya nullable.
--
-- 2. create_manual_schedule TIDAK ter-overload -- harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'create_manual_schedule';
--
--    -> kalau muncul dua baris, drop-nya gagal dan PostgREST bisa memilih
--       signature lama. STOP.
--
-- 3. Grant menempel pada RPC yang dipanggil klien:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('create_manual_schedule', 'sweep_missed_schedules');
--
--    -> `authenticated` wajib muncul untuk keduanya.
--
-- 4. Default grace_days per kategori. Buat satu jadwal tiap kategori lewat
--    aplikasi, lalu:
--
--      select category, grace_days from public.care_schedules
--      where farm_id = '<farm uuid>' order by created_at desc limit 5;
--
--    -> watering 2, spraying 5, fertilizing 10, weeding 14, other NULL.
--
-- 5. Penjaga otorisasi penyapu benar-benar menutup. Login sebagai user yang
--    BUKAN anggota kebun X, lalu panggil sweep_missed_schedules('<farm X>').
--    -> harus tidak mengubah satu baris pun.
--
-- 6. Alur terlewat, dijalankan berurutan pada satu kebun uji:
--
--    a. Buat jadwal berulang kategori watering (grace_days 2 otomatis),
--       repeat_every_days 7, scheduled_date 10 hari lalu.
--    b. Panggil sweep_missed_schedules(farm_id).
--    c. Periksa:
--
--         select id, due_date, status, missed_at from public.care_tasks
--         where farm_id = '<farm>' order by due_date;
--
--       -> tugas lama ber-missed_at terisi, status TETAP 'pending'.
--
--         select id, scheduled_date, missed_at, parent_schedule_id
--         from public.care_schedules where farm_id = '<farm>' order by scheduled_date;
--
--       -> ada penerus dengan parent_schedule_id menunjuk jadwal lama, dan
--          scheduled_date-nya MELEWATI hari ini (bukan tanggal lampau).
--
--    d. Panggil sweep_missed_schedules(farm_id) sekali lagi.
--       -> jumlah baris care_schedules TIDAK bertambah. Kalau bertambah,
--          penjaga idempoten bocor. STOP.
--
-- 7. Rantai tetap maju setelah DUA siklus terlewat berturut-turut -- inilah
--    yang tidak bisa dilakukan versi 041. Majukan waktu uji atau buat jadwal
--    yang scheduled_date-nya cukup tua, sapu, lalu sapu lagi setelah penerus
--    pertama ikut lewat masa toleransi.
--       -> harus lahir penerus kedua.
--
-- 8. Jalur normal (bukan terlewat) tidak berubah: selesaikan tugas dari jadwal
--    berulang lewat aplikasi, pastikan penerus lahir seperti biasa.
--    create_successor_schedule menelan exception-nya sendiri, jadi rantai yang
--    rusak TIDAK muncul sebagai error di aplikasi -- cek log Postgres untuk
--    'Rantai jadwal gagal'.
-- ===========================================================================
