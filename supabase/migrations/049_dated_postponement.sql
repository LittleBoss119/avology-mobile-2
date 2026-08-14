-- 049_dated_postponement.sql
--
-- Penundaan wajib bertanggal.
--
-- Sebelum migrasi ini, "tunda" adalah jalan buntu: ia mencatat bahwa pekerjaan
-- tidak jadi dilakukan, tetapi tidak mengatakan kapan akan dilakukan.
-- care_tasks.due_date tetap di tanggal lama, sehingga tugas yang ditunda
-- selamanya terlihat terlambat dan -- sejak migrasi 048 -- akhirnya hangus
-- kena masa toleransi.
--
-- Sekarang penundaan adalah PENJADWALAN ULANG: pekerja memilih tanggal, dan
-- due_date tugas ikut bergeser ke tanggal itu. Masa toleransi otomatis
-- bergeser bersamanya karena penyapu 048 menghitung due_date + grace_days.
--
-- PRASYARAT: 046, 047, dan 048 sudah dijalankan dan terverifikasi.
--
-- Yang SENGAJA TIDAK disentuh (migrasi 050-051): complete_task,
-- care_activity_trees, dan segala hal soal keanggotaan.

begin;

-- ===========================================================================
-- 1. Kolom postponed_until pada care_activities
--
-- Constraint di bawah divalidasi PENUH (tanpa NOT VALID), mengikuti pola 043.
-- Karena itu baris 'postponed' yang sudah ada -- kalau ada -- akan menggagalkan
-- migrasi ini. Blok penjaga mendahuluinya supaya kegagalannya terbaca sebagai
-- kalimat, bukan sebagai pelanggaran constraint yang tidak menjelaskan apa pun.
--
-- Tidak ada backfill karena tanggal penundaan tidak bisa direka: hanya pekerja
-- yang tahu kapan ia berniat mengerjakannya.
-- ===========================================================================

alter table public.care_activities
  add column if not exists postponed_until date;

comment on column public.care_activities.postponed_until is
  'Tanggal pekerjaan dijadwalkan ulang oleh pekerja. Wajib terisi saat status=''postponed'', wajib NULL saat status=''completed''.';

do $$
declare
  offender_count integer;
begin
  select count(*) into offender_count
  from public.care_activities
  where status = 'postponed' and postponed_until is null;

  if offender_count > 0 then
    raise exception
      'Ada % baris care_activities berstatus postponed tanpa postponed_until. Migrasi 049 tidak bisa mengarang tanggalnya. Bersihkan atau isi baris tersebut lebih dulu.',
      offender_count;
  end if;
end $$;

alter table public.care_activities
  drop constraint if exists care_activities_postponed_until_check;

alter table public.care_activities
  add constraint care_activities_postponed_until_check
  check (
    (status = 'postponed' and postponed_until is not null)
    or (status = 'completed' and postponed_until is null)
  );

-- ===========================================================================
-- 2. Sinkronisasi due_date dari penundaan -- lewat TRIGGER, bukan di dalam RPC
--
-- KEPUTUSAN DESAIN, dicatat di sini karena ada dua kandidat tempat:
--
--   (a) di dalam postpone_task, tepat setelah INSERT aktivitas
--   (b) trigger pada care_activities
--
-- Dipilih (b). Alasannya sama dengan alasan 048 mengangkat logika rantai
-- keluar dari trigger menjadi create_successor_schedule: tanggal penundaan
-- punya DUA jalur tulis, bukan satu.
--
--   * postpone_task  -> INSERT baris aktivitas baru
--   * update_task_realization -> UPDATE baris aktivitas terakhir (bagian 4)
--
-- Kalau pergeseran due_date ditaruh di dalam postpone_task, jalur koreksi harus
-- menyalin logika yang sama, dan dua salinan itu akan berbeda pendapat cepat
-- atau lambat. Dengan trigger, due_date adalah PROYEKSI dari penundaan
-- terakhir -- persis pola yang sudah dipakai sync_task_status_from_activity
-- untuk care_tasks.status.
--
-- CATATAN terhadap invarian 043: komentar di kepala migrasi 043 menyatakan
-- update_task_realization "TIDAK menyentuh care_tasks". Trigger ini membuat
-- pernyataan itu tidak lagi benar secara harfiah untuk kolom due_date. Alasan
-- asli invarian tersebut adalah kolom STATUS -- mesin rantai berulang bergantung
-- pada trigger AFTER INSERT, sehingga status yang berpindah lewat UPDATE akan
-- memutus rantai diam-diam. status TETAP tidak disentuh siapa pun di sini.
--
-- Urutan trigger: nama 'sync_task_due_date_...' berada sebelum
-- 'sync_task_status_...' secara alfabetis, jadi ia berjalan lebih dulu. Keduanya
-- menyentuh kolom berbeda sehingga urutannya tidak berpengaruh, dan keduanya
-- tetap berjalan sebelum trigger 'zz_' milik rantai.
-- ===========================================================================

create or replace function public.sync_task_due_date_from_postponement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.care_task_id is null then
    return new;
  end if;

  -- Hanya baris penundaan yang menggeser tenggat. Baris 'completed' tidak
  -- pernah punya postponed_until (dijaga constraint bagian 1).
  if new.status is distinct from 'postponed' or new.postponed_until is null then
    return new;
  end if;

  update public.care_tasks
  set due_date = new.postponed_until,
      updated_at = now()
  where id = new.care_task_id
    and due_date is distinct from new.postponed_until;

  return new;
end;
$$;

revoke all on function public.sync_task_due_date_from_postponement() from public, anon;

drop trigger if exists sync_task_due_date_from_postponement_trigger
  on public.care_activities;

create trigger sync_task_due_date_from_postponement_trigger
  after insert or update on public.care_activities
  for each row
  execute function public.sync_task_due_date_from_postponement();

-- ===========================================================================
-- 3. postpone_task -- sekarang wajib bertanggal
--
-- Signature berubah, jadi fungsi lama WAJIB di-drop lebih dulu. `create or
-- replace` dengan daftar parameter berbeda hanya membuat OVERLOAD baru, lalu
-- PostgREST menghadapi dua kandidat dan bisa memilih yang salah -- kelas bug
-- yang ditangani migrasi 024 dan diperingatkan ulang di 043, 047, dan 048.
--
-- Ketiga parameter wajib dan tidak ada yang berdefault, jadi aturan "parameter
-- tanpa default tidak boleh setelah parameter berdefault" tidak tersentuh di
-- sini.
-- ===========================================================================

drop function if exists public.postpone_task(uuid, text);

create or replace function public.postpone_task(
  p_task_id uuid,
  p_note text,
  p_postponed_until date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  task_farm_id uuid;
  task_assigned_to uuid;
  task_missed_at timestamptz;
  new_activity_id uuid;
begin
  -- Kewajiban catatan dipertahankan apa adanya dari 008:786, termasuk pesan
  -- Inggrisnya, supaya penanganan error di klien tidak berubah.
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'Postpone note is required';
  end if;

  if p_postponed_until is null then
    raise exception 'Tanggal penundaan wajib diisi.';
  end if;

  -- Menunda ke hari ini atau ke masa lalu bukan penundaan; itu cuma cara lain
  -- mengatakan "tidak dikerjakan".
  if p_postponed_until <= today_wib then
    raise exception 'Tanggal penundaan harus setelah hari ini.';
  end if;

  select farm_id, assigned_to, missed_at
  into task_farm_id, task_assigned_to, task_missed_at
  from public.care_tasks
  where id = p_task_id;

  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can postpone this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can postpone tasks';
  end if;

  -- Tugas yang sudah hangus tidak bisa dijadwalkan ulang: penyapu 048 sudah
  -- memajukan rantainya, dan penerusnya sudah ada. Menunda tugas hangus akan
  -- menghidupkan kembali siklus yang secara resmi sudah lewat.
  if task_missed_at is not null then
    raise exception 'Tugas ini sudah terlewat dan tidak bisa ditunda lagi.';
  end if;

  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note,
    postponed_until
  )
  values (
    task_farm_id,
    p_task_id,
    current_user_id,
    'postponed',
    p_note,
    p_postponed_until
  )
  returning id into new_activity_id;

  -- due_date TIDAK digeser di sini. Lihat catatan bagian 2: pergeseran itu
  -- pekerjaan sync_task_due_date_from_postponement_trigger, supaya jalur
  -- koreksi lewat update_task_realization memakai implementasi yang sama.

  return new_activity_id;
end;
$$;

revoke execute on function public.postpone_task(uuid, text, date) from public, anon;
grant execute on function public.postpone_task(uuid, text, date) to authenticated;

-- ===========================================================================
-- 4. update_task_realization -- tanggal penundaan bisa dikoreksi
--
-- Signature berubah (bertambah p_postponed_until), jadi drop lebih dulu.
-- Parameter baru BERDEFAULT dan diletakkan di akhir.
--
-- Seluruh aturan 043 dipertahankan: hanya pencatatnya, hanya baris TERAKHIR,
-- hanya kalau jadwal induknya belum dibatalkan, status dan performed_at tidak
-- pernah disentuh.
-- ===========================================================================

drop function if exists public.update_task_realization(uuid, text, text, numeric, text);

create or replace function public.update_task_realization(
  p_activity_id uuid,
  p_note text default null,
  p_produk text default null,
  p_produk_jumlah numeric default null,
  p_produk_satuan text default null,
  p_postponed_until date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  target public.care_activities%rowtype;
  parent_task public.care_tasks%rowtype;
  latest_activity_id uuid;
  schedule_is_cancelled boolean;
  final_postponed_until date;
  clean_note text := nullif(trim(p_note), '');
  clean_produk text := nullif(trim(p_produk), '');
  clean_satuan text := nullif(trim(p_produk_satuan), '');
begin
  -- 1. Baris aktivitasnya ada.
  select * into target
  from public.care_activities
  where id = p_activity_id;

  if target.id is null then
    raise exception 'Catatan tidak ditemukan.';
  end if;

  -- 2. Hanya realisasi tugas. Catatan inisiatif (care_task_id null) memang
  --    tidak bisa diedit sama sekali -- keputusan desain migrasi 027.
  if target.care_task_id is null then
    raise exception 'Catatan ini bukan hasil kerja dari tugas.';
  end if;

  -- 3. Hanya pencatatnya sendiri.
  if target.performed_by is distinct from current_user_id then
    raise exception 'Hanya pencatat yang bisa memperbaiki catatan ini.';
  end if;

  -- 4. Dan dia harus masih pekerja aktif di kebun itu.
  if not public.is_active_worker(target.farm_id, current_user_id) then
    raise exception 'Hanya pekerja aktif yang bisa memperbaiki catatan.';
  end if;

  -- 5. Harus baris TERAKHIR untuk tugas tersebut.
  --    Tie-breaker `id desc` wajib: tanpa itu dua baris dengan performed_at
  --    identik bikin "terakhir" berpindah-pindah antar pemanggilan, dan
  --    fungsi ini bisa memperbaiki baris yang salah.
  select id into latest_activity_id
  from public.care_activities
  where care_task_id = target.care_task_id
  order by performed_at desc, id desc
  limit 1;

  if latest_activity_id is distinct from p_activity_id then
    raise exception 'Hanya catatan terbaru yang bisa diperbaiki.';
  end if;

  -- 6. Jadwal induknya tidak dibatalkan owner.
  --    care_schedule_id null = tugas dari laporan operasional, tidak punya
  --    jadwal induk, jadi pemeriksaan ini dilewati.
  select * into parent_task
  from public.care_tasks
  where id = target.care_task_id;

  if parent_task.care_schedule_id is not null then
    select is_cancelled into schedule_is_cancelled
    from public.care_schedules
    where id = parent_task.care_schedule_id;

    if coalesce(schedule_is_cancelled, false) then
      raise exception 'Tugas ini sudah dibatalkan oleh owner.';
    end if;
  end if;

  -- 7. Aturan khusus baris yang ditunda.
  if target.status = 'postponed' then
    if clean_note is null then
      raise exception 'Catatan penundaan wajib diisi.';
    end if;

    -- Ditunda berarti pekerjaannya tidak dilakukan, jadi tidak ada bahan
    -- yang terpakai.
    if clean_produk is not null
       or p_produk_jumlah is not null
       or clean_satuan is not null then
      raise exception 'Bahan hanya dicatat pada hasil kerja yang selesai.';
    end if;

    -- Tanggal penundaan opsional di jalur koreksi: kalau tidak dikirim, nilai
    -- lama dipertahankan. Constraint bagian 1 melarangnya menjadi NULL, dan
    -- memaksa pekerja memilih ulang tanggal hanya untuk membetulkan salah ketik
    -- pada catatan jelas bukan yang diinginkan.
    if p_postponed_until is not null then
      -- Validasi yang sama persis dengan postpone_task.
      if p_postponed_until <= today_wib then
        raise exception 'Tanggal penundaan harus setelah hari ini.';
      end if;

      final_postponed_until := p_postponed_until;
    else
      final_postponed_until := target.postponed_until;
    end if;
  else
    if p_postponed_until is not null then
      raise exception 'Tanggal penundaan hanya berlaku untuk hasil kerja yang ditunda.';
    end if;

    final_postponed_until := null;
  end if;

  -- 8. Validasi pasangan bahan, sama persis seperti di complete_task.
  if (p_produk_jumlah is not null or clean_satuan is not null)
     and clean_produk is null then
    raise exception 'Nama bahan wajib diisi kalau takaran diisi.';
  end if;

  if (p_produk_jumlah is null) <> (clean_satuan is null) then
    raise exception 'Takaran dan satuan harus diisi berdua.';
  end if;

  -- Daftar kolom di bawah adalah SELURUH kolom yang boleh disentuh fungsi ini.
  -- JANGAN menambahkan status atau performed_at ke sini.
  --
  -- postponed_until ikut di sini sejak migrasi 049. Perubahannya membuat
  -- sync_task_due_date_from_postponement_trigger berbunyi, sehingga
  -- care_tasks.due_date ikut bergeser -- itu memang tujuannya.
  update public.care_activities
  set note = clean_note,
      produk = clean_produk,
      produk_jumlah = p_produk_jumlah,
      produk_satuan = clean_satuan,
      postponed_until = final_postponed_until,
      edited_at = now()
  where id = p_activity_id;

  return p_activity_id;
end;
$function$;

revoke execute on function public.update_task_realization(uuid, text, text, numeric, text, date)
  from public, anon;

grant execute on function public.update_task_realization(uuid, text, text, numeric, text, date)
  to authenticated;

-- ===========================================================================
-- 5. Muat ulang cache schema PostgREST
--    Dua signature RPC berubah; tanpa ini klien memanggil bentuk lama dan
--    kena PGRST202.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom dan constraint terpasang, convalidated true:
--
--      select conname, convalidated from pg_constraint
--      where conrelid = 'public.care_activities'::regclass
--        and conname = 'care_activities_postponed_until_check';
--
-- 2. Kedua RPC TIDAK ter-overload -- masing-masing harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('postpone_task', 'update_task_realization')
--      order by 1;
--
--    -> harus postpone_task(uuid, text, date) dan
--       update_task_realization(uuid, text, text, numeric, text, date).
--       Kalau salah satu muncul dua kali, drop-nya gagal. STOP.
--
-- 3. Grant menempel pada keduanya:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('postpone_task', 'update_task_realization');
--
-- 4. Urutan trigger pada care_activities -- 'zz_' harus paling bawah:
--
--      select t.tgname
--      from pg_trigger t join pg_class c on c.oid = t.tgrelid
--      where c.relname = 'care_activities' and not t.tgisinternal
--      order by t.tgname;
--
--    -> harapkan lima: validate_care_activity_trigger,
--       sync_task_due_date_from_postponement_trigger,
--       sync_task_status_from_activity_trigger,
--       zz_cleanup_orphan_recurring_schedule_trigger,
--       zz_create_next_recurring_schedule_trigger.
--
-- 5. Alur tunda, lewat aplikasi:
--    a. Buka tugas yang jatuh tempo hari ini, tunda ke 3 hari lagi.
--    b. Periksa:
--
--         select t.due_date, a.status, a.postponed_until
--         from public.care_tasks t
--         join public.care_activities a on a.care_task_id = t.id
--         where t.id = '<task uuid>'
--         order by a.performed_at desc limit 1;
--
--       -> due_date HARUS sudah sama dengan postponed_until.
--       -> status tugas 'postponed'.
--
-- 6. Koreksi tanggal lewat "Perbaiki catatan": ubah tanggal ke 5 hari lagi.
--    -> due_date ikut bergeser lagi. Kalau tidak, trigger tidak berbunyi pada
--       UPDATE. STOP.
--
-- 7. Penolakan yang harus terjadi:
--    a. Tunda ke hari ini            -> 'Tanggal penundaan harus setelah hari ini.'
--    b. Tunda tanpa catatan          -> 'Postpone note is required'
--    c. Tunda tugas yang sudah hangus -> 'Tugas ini sudah terlewat dan tidak bisa ditunda lagi.'
--       (siapkan dengan menjalankan sweep_missed_schedules pada tugas lewat toleransi)
--
-- 8. Interaksi dengan masa toleransi 048: setelah ditunda, penyapu TIDAK boleh
--    langsung menandai tugas itu terlewat, karena due_date sudah maju.
--
--      select public.sweep_missed_schedules('<farm uuid>');
--      select missed_at from public.care_tasks where id = '<task uuid>';
--
--    -> harus tetap NULL.
-- ===========================================================================
