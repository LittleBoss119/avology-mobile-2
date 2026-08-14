-- 051_release_tasks_on_membership_exit.sql
--
-- Tugas terbuka dilepas saat keanggotaan berhenti 'active'.
--
-- MASALAHNYA: keanggotaan bisa berubah RETROAKTIF tanpa satu pun tulisan ke
-- care_tasks. remove_worker (036:448) dan leave_current_farm (036:487)
-- menyetel status 'removed'; lalu request_join_farm (036:237) melakukan UPSERT
-- `do update set status='pending'` yang MEMAKAI ULANG baris keanggotaan yang
-- sama -- farm_members.id dan user_id tidak berubah. Tugas lama karena itu
-- otomatis menjadi milik anggota non-active.
--
-- Tugas seperti itu terjebak di tengah: tidak terlihat mantan pekerja (RLS
-- butuh is_active_worker), tidak bisa ditugaskan ulang (assign_worker menolak
-- jadwal yang sudah punya tugas), tapi tetap dihitung sebagai tunggakan di
-- dashboard owner.
--
-- Penanganannya berdasar "keanggotaan berhenti 'active'", BUKAN berdasar nilai
-- status 'removed' saja: kedua jalur keluar diperlakukan sama, dan yang
-- dilepas ditentukan oleh MOMEN perpindahan, bukan oleh nilai akhirnya.
--
-- request_join_farm SENGAJA TIDAK DISENTUH. UPSERT yang memakai ulang baris
-- adalah perilaku yang diinginkan untuk keanggotaan; yang salah adalah tugas
-- yang tertinggal, dan itulah yang diperbaiki di sini.
--
-- PRASYARAT: 046-050 sudah dijalankan dan terverifikasi.
--
-- ---------------------------------------------------------------------------
-- FAKTA YANG MENENTUKAN SELURUH BENTUK MIGRASI INI
--
-- validate_care_task_trigger adalah `before insert OR UPDATE` (006:501-505),
-- dan validate_care_task() versi hidup (046:81) mewajibkan assigned_to seorang
-- pekerja AKTIF. Konsekuensinya keras:
--
--   Begitu keanggotaan diflip ke non-active, SETIAP UPDATE ke baris tugas
--   miliknya akan gagal dengan 'Care tasks can only be assigned to active
--   workers' -- tidak peduli kolom mana yang disentuh, dan tidak bisa
--   dilewati SECURITY DEFINER karena trigger raise tanpa peduli role pemanggil.
--
-- Karena itu pelepasan WAJIB dijalankan SEBELUM `update farm_members`, bukan
-- sesudah. Urutan itu bukan gaya penulisan; membaliknya membuat kedua RPC
-- keluar-kebun gagal total. Ini juga sebabnya trigger TIDAK dilonggarkan:
-- penjaga itu satu-satunya penegakan efektif untuk assigned_to (dicatat
-- 046:76-80), dan melonggarkannya demi migrasi ini akan membuka kembali jalur
-- penugasan ke anggota non-active yang justru sedang kita tutup.
--
-- EFEK SAMPING YANG DISENGAJA: baris yang sudah dilepas menjadi BEKU selama
-- pemiliknya non-active -- tidak ada UPDATE yang bisa menyentuhnya lagi.
-- Itu sebabnya penyapu 048 di bagian 7 harus ikut melewatinya; tanpa itu
-- sweep_missed_schedules akan meledak saat mencoba menandai baris beku, dan
-- karena ia dipanggil dari jalur BACA aplikasi, seluruh pembacaan daftar
-- tugas ikut gagal.
-- ---------------------------------------------------------------------------
--
-- BENTUK "DILEPAS" yang dipilih: kolom released_at + released_reason, status
-- dibiarkan apa adanya. Alasannya sebabnya bisa dibedakan dari 'terlewat'
-- (missed_at, 048) -- mantan pekerja tidak terlihat lalai atas pekerjaan yang
-- ia tinggalkan secara sah -- dan tidak ada nilai enum baru yang tidak bisa
-- dicabut (pelajaran 047:13-17, dan alasan yang sama membuat 036:501 memilih
-- menghapus baris ketimbang menambah nilai member_status).
--
-- HARGANYA, dan ini yang harus dijaga terus: setiap pembaca "tugas terbuka"
-- WAJIB ikut menyaring `released_at is null`. Bagian 2, 6, 7, dan 8 di bawah
-- menutup seluruh titik di database; sisi aplikasi ditutup di commit yang sama.

begin;

-- ===========================================================================
-- 1. Kolom pelepasan pada care_tasks
--
-- released_reason dikunci ke dua nilai yang sama persis dengan
-- farm_members.removed_reason pada kedua jalur keluar (036:448, 036:487),
-- supaya sebab di tabel tugas dan sebab di tabel keanggotaan bisa dipadankan
-- tanpa tabel penerjemah.
--
-- 'rejected_by_owner' TIDAK ikut: baris berstatus 'rejected' tidak pernah
-- 'active', jadi tidak mungkin punya tugas.
--
-- Tanpa NOT VALID: seluruh baris lama bernilai NULL di kedua kolom dan lolos
-- cabang pertama, jadi validasi penuh tidak perlu ditakuti.
-- ===========================================================================

alter table public.care_tasks
  add column if not exists released_at timestamptz,
  add column if not exists released_reason text;

comment on column public.care_tasks.released_at is
  'Kapan tugas ini dilepas karena pekerjanya berhenti aktif di kebun. NULL = masih melekat pada pekerjanya. BUKAN missed_at: dilepas berarti pekerjaannya tidak pernah jadi tanggungan siapa pun lagi, bukan bahwa pekerjanya lalai.';
comment on column public.care_tasks.released_reason is
  'Sebab pelepasan, memakai kosakata yang sama dengan farm_members.removed_reason: ''removed_by_owner'' atau ''left_by_worker''.';

alter table public.care_tasks
  drop constraint if exists care_tasks_released_pair_check;

alter table public.care_tasks
  add constraint care_tasks_released_pair_check
  check (
    (released_at is null and released_reason is null)
    or (
      released_at is not null
      and released_reason in ('removed_by_owner', 'left_by_worker')
    )
  );

-- ===========================================================================
-- 2. Index parsial 048:67 ikut menyempit
--
-- Predikat index parsial adalah bagian dari definisinya, jadi ia tidak bisa
-- diubah lewat `create index if not exists` -- nama yang sama membuat
-- pernyataan itu diam-diam jadi no-op dan index lama bertahan dengan predikat
-- lama. Harus di-drop lebih dulu.
--
-- Index ini melayani penyapu 048 dan penghitung tunggakan. Sejak migrasi ini
-- "terbuka" berarti belum terlewat DAN belum dilepas, jadi predikatnya wajib
-- ikut, kalau tidak baris yang dilepas tetap terpungut.
-- ===========================================================================

drop index if exists public.idx_care_tasks_open_not_missed;

create index if not exists idx_care_tasks_open_not_missed
  on public.care_tasks (farm_id, due_date)
  where missed_at is null
    and released_at is null
    and status in ('pending', 'postponed');

-- ===========================================================================
-- 3. release_open_tasks_for_member -- satu salinan aturan pelepasan
--
-- Diangkat menjadi fungsi tersendiri, bukan disalin ke dalam remove_worker dan
-- leave_current_farm, dengan alasan yang sama seperti 048 mengangkat logika
-- rantai menjadi create_successor_schedule: ada DUA pemanggil, dan dua salinan
-- definisi "tugas terbuka" pasti bergeser satu sama lain cepat atau lambat.
--
-- Definisi tugas terbuka dipakai apa adanya dari instruksi:
--   status in ('pending','postponed') DAN missed_at is null.
-- `released_at is null` ditambahkan supaya pemanggilan kedua tidak menimpa
-- waktu dan sebab pelepasan pertama.
--
-- Tugas dari laporan operasional (care_schedule_id NULL) IKUT dilepas: ia juga
-- tanggungan pekerja yang sekarang sudah pergi, dan tanpa pelepasan laporannya
-- terkunci selamanya oleh penjaga 'already has an open follow up task'
-- (diperbaiki di bagian 6).
--
-- SECURITY DEFINER karena pemanggilnya sudah definer dan tabel ini tertutup
-- RLS untuk jalur tulis. Grant dicabut dari SEMUA role klien: fungsi ini bukan
-- API, ia bagian dalam dari dua RPC keanggotaan. Pemanggilan dari dalam fungsi
-- definer tidak terpengaruh pencabutan itu.
-- ===========================================================================

create or replace function public.release_open_tasks_for_member(
  p_farm_id uuid,
  p_user_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer;
begin
  if p_farm_id is null or p_user_id is null then
    return 0;
  end if;

  if p_reason not in ('removed_by_owner', 'left_by_worker') then
    raise exception 'Sebab pelepasan tugas tidak dikenal: %', p_reason;
  end if;

  -- PERINGATAN URUTAN: UPDATE ini membangunkan validate_care_task_trigger,
  -- yang mewajibkan assigned_to masih pekerja AKTIF. Fungsi ini karena itu
  -- HANYA boleh dipanggil selagi keanggotaannya masih 'active' -- yaitu
  -- SEBELUM `update farm_members set status = 'removed'`. Lihat kepala file.
  update public.care_tasks
  set released_at = now(),
      released_reason = p_reason,
      updated_at = now()
  where farm_id = p_farm_id
    and assigned_to = p_user_id
    and status in ('pending', 'postponed')
    and missed_at is null
    and released_at is null;

  get diagnostics released_count = row_count;

  return released_count;
end;
$$;

revoke all on function public.release_open_tasks_for_member(uuid, uuid, text)
  from public, anon, authenticated;

-- ===========================================================================
-- 4. remove_worker -- melepas tugas sebelum mencabut keanggotaan
--
-- Signature TETAP (uuid), jadi `create or replace` dan grant yang sudah
-- menempel tidak perlu ditulis ulang. Seluruh badan 036:420-457 dipertahankan
-- VERBATIM; yang ditambahkan hanya satu `perform` sebelum UPDATE keanggotaan.
-- ===========================================================================

create or replace function public.remove_worker(
  p_farm_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_farm_id uuid;
  target_user_id uuid;
begin
  select farm_id, user_id
  into target_farm_id, target_user_id
  from public.farm_members
  where id = p_farm_member_id
    and role = 'worker'
    and status = 'active';

  if target_farm_id is null then
    raise exception 'Active worker not found';
  end if;

  if not public.is_active_owner(target_farm_id, current_user_id) then
    raise exception 'Only active owners can remove workers';
  end if;

  -- BARU. WAJIB mendahului UPDATE di bawah: setelah status berpindah dari
  -- 'active', validate_care_task_trigger menolak setiap UPDATE ke tugas milik
  -- orang ini dan pelepasan menjadi mustahil selamanya.
  perform public.release_open_tasks_for_member(
    target_farm_id, target_user_id, 'removed_by_owner'
  );

  update public.farm_members
  set status = 'removed',
      removed_at = now(),
      removed_by = current_user_id,
      removed_reason = 'removed_by_owner',
      updated_at = now()
  where id = p_farm_member_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (target_farm_id, target_user_id, 'removed', current_user_id);
end;
$$;

-- ===========================================================================
-- 5. leave_current_farm -- padanan untuk jalur keluar atas kemauan sendiri
--
-- Sama persis perlakuannya. target_user_id di sini adalah current_user_id:
-- pekerja hanya bisa mengeluarkan dirinya sendiri (036:487).
-- ===========================================================================

create or replace function public.leave_current_farm(
  p_farm_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_membership_id uuid;
begin
  select id
  into target_membership_id
  from public.farm_members
  where farm_id = p_farm_id
    and user_id = current_user_id
    and role = 'worker'
    and status = 'active';

  if target_membership_id is null then
    raise exception 'Active worker membership not found';
  end if;

  -- BARU. Alasan urutannya sama seperti di remove_worker.
  perform public.release_open_tasks_for_member(
    p_farm_id, current_user_id, 'left_by_worker'
  );

  update public.farm_members
  set status = 'removed',
      removed_at = now(),
      removed_by = current_user_id,
      removed_reason = 'left_by_worker',
      updated_at = now()
  where id = target_membership_id;

  insert into public.farm_access_events (farm_id, user_id, event, actor_id)
  values (p_farm_id, current_user_id, 'left', current_user_id);
end;
$$;

-- ===========================================================================
-- 6. Penjaga "sudah punya tugas" pada dua jalur penugasan
--
-- 6a. assign_worker_to_care_schedule -- signature TETAP (uuid, uuid), badan
--     047:361-414 dipertahankan verbatim kecuali satu penjaga.
--
--     Dulu: menolak kalau jadwal punya tugas APA PUN. Sekarang: menolak kalau
--     jadwal masih punya tugas yang BELUM DILEPAS. Pelonggarannya sesempit
--     mungkin -- tugas yang selesai dan tugas yang terlewat TETAP memblokir,
--     persis seperti sebelumnya. Hanya baris terlepas yang berhenti memblokir,
--     dan itulah yang membuat jadwal bisa ditugaskan ulang.
--
--     Penjaga is_active_worker di atasnya tidak disentuh, jadi penugasan ulang
--     tetap hanya bisa ke pekerja yang benar-benar aktif.
-- ===========================================================================

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

  -- DILONGGARKAN: `and released_at is null`. Pesan errornya sengaja tidak
  -- diubah supaya penanganan di klien tidak bergeser.
  if exists (
    select 1 from public.care_tasks
    where care_schedule_id = p_schedule_id
      and released_at is null
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

-- ---------------------------------------------------------------------------
-- 6b. create_task_from_operational_report -- penjaga yang setara.
--
-- Tanpa ini, laporan operasional yang tugas tindak lanjutnya dilepas terkunci
-- selamanya: penjaga 'already has an open follow up task' (047:306-312) masih
-- melihat baris pending milik mantan pekerja, sehingga owner tidak bisa
-- menugaskan tindak lanjut kepada siapa pun lagi. Persis gejala yang sama
-- dengan jadwal yang tidak bisa ditugaskan ulang, hanya di jalur yang berbeda.
--
-- Signature TETAP seperti 047 (urutan parameternya juga), jadi `create or
-- replace` cukup dan grant tidak perlu ditulis ulang. Badan 047:254-346
-- dipertahankan verbatim kecuali satu baris pada penjaga tersebut.
-- ---------------------------------------------------------------------------

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

  -- DILONGGARKAN: `and t.released_at is null`.
  if exists (
    select 1 from public.care_tasks t
    where t.operational_report_id = p_operational_report_id
      and t.status in ('pending', 'postponed')
      and t.released_at is null
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

-- ===========================================================================
-- 7. sweep_missed_schedules -- dua penyesuaian
--
-- Signature TETAP (uuid); badan 048:324-420 dipertahankan verbatim kecuali dua
-- predikat.
--
-- 7a (bagian 5a) `and t.released_at is null` -- BUKAN kosmetik. Tanpa ini
--    penyapu mencoba meng-UPDATE baris tugas milik anggota non-active, dan
--    validate_care_task_trigger meledak. Karena penyapu dipanggil dari jalur
--    BACA aplikasi (daftar jadwal, daftar tugas, dashboard), ledakan itu
--    menggagalkan pembacaan, bukan hanya penyapuannya.
--
-- 7b (bagian 5b) cabang "belum punya tugas sama sekali" menjadi "belum punya
--    tugas AKTIF". Ini menyamakan jadwal yang tugasnya dilepas dengan jadwal
--    penerus yang lahir tanpa tugas karena pekerjanya sudah keluar (cabang
--    041:133) -- dua keadaan yang secara operasional identik: ada pekerjaan
--    terjadwal, tidak ada yang memikulnya.
--
--    AKIBATNYA rantai berulang TETAP MAJU walau owner tidak pernah menugaskan
--    ulang: jadwalnya dinyatakan terlewat setelah scheduled_date + grace_days,
--    lalu create_successor_schedule melahirkan siklus berikutnya. Tanpa ini,
--    penjaga satu-jadwal-terbuka-per-rantai melihat jadwal itu terbuka
--    selamanya dan rantainya mandek diam-diam.
--
--    HARGA yang diterima sadar: begitu ditandai terlewat, jadwal itu keluar
--    dari daftar tunggakan owner. Pengingat "ini belum ditugaskan ulang" hanya
--    bertahan selama masa toleransi, tidak selamanya.
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
    -- 7a: tugas yang dilepas bukan tanggungan siapa pun, jadi tidak bisa
    -- terlewat. Lihat kepala bagian 7 -- baris ini juga yang mencegah penyapu
    -- menabrak validate_care_task_trigger pada baris beku.
    and t.released_at is null
    and s.is_cancelled = false
    and s.grace_days is not null
    and (t.due_date + s.grace_days) < today_wib;

  -- 5b. Tandai JADWAL-nya.
  --
  -- Dua sumber:
  --   * jadwal yang tugasnya baru saja ditandai di 5a
  --   * jadwal berulang yang belum pernah punya tugas AKTIF (cabang 041:133,
  --     dan sejak migrasi ini juga jadwal yang tugasnya dilepas) dan sudah
  --     lewat masa toleransi dihitung dari scheduled_date
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
          -- 7b: baris terlepas tidak dihitung sebagai "punya tugas".
          select 1 from public.care_tasks t
          where t.care_schedule_id = s.id
            and t.released_at is null
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

-- ===========================================================================
-- 8. Muat ulang cache schema PostgREST
--
-- Tidak ada signature yang berubah di migrasi ini, tetapi ada satu fungsi baru
-- dan dua kolom baru. Reload murah dan konsisten dengan migrasi sebelumnya.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom dan constraint terpasang, convalidated true:
--
--      select conname, convalidated from pg_constraint
--      where conrelid = 'public.care_tasks'::regclass
--        and conname = 'care_tasks_released_pair_check';
--
-- 2. Index parsial benar-benar TERGANTI, bukan bertahan dengan predikat lama.
--    Ini jebakan utama migrasi ini -- `create index if not exists` dengan nama
--    yang sama tidak akan mengeluh apa pun kalau drop-nya gagal:
--
--      select indexdef from pg_indexes
--      where indexname = 'idx_care_tasks_open_not_missed';
--
--    -> definisinya WAJIB memuat `released_at IS NULL`. Kalau tidak, STOP.
--
-- 3. Empat fungsi TIDAK ter-overload -- masing-masing tepat satu baris, dan
--    signature-nya sama persis seperti sebelum migrasi ini:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('remove_worker', 'leave_current_farm',
--                          'assign_worker_to_care_schedule',
--                          'create_task_from_operational_report',
--                          'sweep_missed_schedules',
--                          'release_open_tasks_for_member')
--      order by 1;
--
-- 4. Grant tetap utuh (tidak ada DROP FUNCTION di migrasi ini), DAN helper
--    baru tidak bocor ke klien:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('remove_worker', 'leave_current_farm',
--                             'assign_worker_to_care_schedule',
--                             'create_task_from_operational_report',
--                             'release_open_tasks_for_member')
--      order by 1, 2;
--
--    -> `authenticated` wajib ada untuk empat yang pertama.
--    -> release_open_tasks_for_member TIDAK BOLEH punya baris untuk
--       authenticated/anon/public.
--
-- 5. URUTAN DI DALAM remove_worker -- inti migrasi ini. Uji ALUR NYATA, bukan
--    katalog. Sebagai owner, lewat aplikasi:
--      a. Buat jadwal, tugaskan ke pekerja aktif, biarkan pending.
--      b. Keluarkan pekerja itu lewat layar pekerja.
--      -> RPC harus SUKSES. Kalau muncul 'Care tasks can only be assigned to
--         active workers', berarti urutannya terbalik. STOP.
--      c. select released_at, released_reason, status from public.care_tasks
--         where id = '<task uuid>';
--      -> released_at terisi, released_reason = 'removed_by_owner',
--         status TETAP 'pending' (tidak diubah).
--
-- 6. Padanannya untuk leave_current_farm: sebagai pekerja, keluar dari kebun
--    sendiri. -> released_reason = 'left_by_worker'.
--
-- 7. PENUGASAN ULANG. Setelah langkah 5, sebagai owner buka detail jadwal itu
--    dan tugaskan ke pekerja aktif lain.
--    -> harus BERHASIL. Sebelum migrasi ini pasti gagal dengan
--       'Schedule already has a task'.
--    -> dan jadwal itu muncul di layar Jadwal dengan penanda "Belum ada
--       pekerja" SEBELUM ditugaskan ulang.
--
-- 8. Tugas yang SELESAI tetap memblokir -- pelonggaran tidak boleh kebablasan:
--    selesaikan sebuah tugas, lalu coba assign_worker_to_care_schedule pada
--    jadwal yang sama. -> harus tetap gagal 'Schedule already has a task'.
--
-- 9. LAPORAN OPERASIONAL tidak ikut terkunci: buat tugas tindak lanjut dari
--    laporan, keluarkan pekerjanya, lalu buat tugas tindak lanjut baru dari
--    laporan yang sama. -> harus berhasil, bukan 'already has an open follow
--    up task'.
--
-- 10. PENYAPU tidak meledak setelah ada tugas terlepas. Panggil langsung:
--
--       select public.sweep_missed_schedules('<farm uuid>');
--
--     -> harus selesai tanpa error. Sebelum perbaikan 7a, baris terlepas milik
--        anggota non-active akan memicu validate_care_task_trigger dan
--        menggagalkan seluruh pembacaan yang memanggil penyapu.
--
-- 11. RANTAI tetap maju (perbaikan 7b). Buat jadwal BERULANG ber-grace_days,
--     tugaskan, keluarkan pekerjanya, lalu majukan waktu uji melewati
--     scheduled_date + grace_days dan panggil penyapu.
--     -> care_schedules.missed_at terisi untuk jadwal itu, DAN lahir penerus
--        dengan parent_schedule_id menunjuk ke sana.
--     -> create_successor_schedule menelan exception-nya sendiri, jadi rantai
--        yang rusak TIDAK muncul sebagai error. Cek log Postgres untuk
--        'Rantai jadwal gagal'.
--
-- 12. KASUS RETROAKTIF yang jadi sebab migrasi ini. Setelah langkah 5, minta
--     mantan pekerja itu request_join_farm ke kebun yang sama lalu setujui.
--     Baris keanggotaannya dipakai ulang (036:237), sehingga ia aktif kembali
--     dengan user_id yang sama.
--     -> tugas lamanya TIDAK BOLEH muncul kembali sebagai tunggakan di layar
--        tugas pekerja maupun di dashboard. Kalau muncul, ada penghitung yang
--        belum menyaring released_at.
-- ===========================================================================
