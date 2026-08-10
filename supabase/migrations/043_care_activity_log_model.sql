-- 043_care_activity_log_model.sql
--
-- Menegaskan care_activities sebagai LOG, bukan STATE.
--
-- Model yang berlaku sejak migrasi ini:
--   * care_activities  = log append-only. Satu tugas boleh punya banyak baris.
--   * care_tasks.status = state. Nilainya selalu sama dengan status baris
--     aktivitas paling akhir, dan disinkronkan oleh trigger
--     sync_task_status_from_activity (AFTER INSERT, migrasi 010).
--
-- Dua aksi dipisah tegas:
--   * "Catat hasil kerja" -> INSERT baris baru (complete_task / postpone_task).
--   * "Perbaiki catatan"  -> UPDATE baris TERAKHIR lewat update_task_realization,
--     dan status TIDAK BOLEH ikut berubah.
--
-- ALASAN status tidak boleh diubah lewat UPDATE:
--   Mesin rantai jadwal berulang (migrasi 041) bergantung pada trigger
--   zz_create_next_recurring_schedule_trigger yang berbunyi AFTER INSERT saja.
--   Kalau status bisa berpindah ke 'completed' lewat UPDATE, penerus rantai
--   tidak akan pernah dibuat dan rantainya putus diam-diam tanpa error.
--   Karena itu update_task_realization di bawah sengaja TIDAK menyentuh kolom
--   status, TIDAK menyentuh performed_at, dan TIDAK menyentuh care_tasks.
--
-- Migrasi ini aditif terhadap data: tiga kolom baru semuanya nullable dan
-- seluruh baris lama bernilai null di kolom-kolom itu, sehingga semua
-- constraint di bawah aman divalidasi penuh (tanpa NOT VALID).

-- ---------------------------------------------------------------------------
-- 1. Kolom takaran bahan pada care_activities
--
-- Kolom `produk` (nama bahan, teks bebas) sudah ada sejak migrasi 025.
-- Yang ditambahkan di sini adalah takarannya, dipecah jadi angka + satuan
-- supaya bisa dijumlahkan per kebun, bukan disimpan sebagai satu string.
--
-- `edited_at` memisahkan "kapan pekerjaan dilakukan" (performed_at, tidak
-- pernah berubah) dari "kapan catatannya terakhir diperbaiki".
-- ---------------------------------------------------------------------------

alter table public.care_activities
  add column if not exists produk_jumlah numeric(10,2),
  add column if not exists produk_satuan text,
  add column if not exists edited_at timestamptz;

comment on column public.care_activities.produk_jumlah is
  'Takaran bahan yang dipakai. NULL kalau tidak dicatat. Selalu berpasangan dengan produk_satuan.';
comment on column public.care_activities.produk_satuan is
  'Satuan takaran bahan. NULL kalau tidak dicatat. Selalu berpasangan dengan produk_jumlah.';
comment on column public.care_activities.edited_at is
  'Kapan catatan terakhir diperbaiki lewat update_task_realization. NULL = belum pernah diperbaiki. BUKAN pengganti performed_at.';

-- Daftar satuan sengaja dikunci di database, bukan cuma di UI: baris bisa
-- masuk lewat SQL Editor atau service_role, dan satuan bebas bikin agregasi
-- ("berapa kg pupuk bulan ini") mustahil dihitung.
alter table public.care_activities
  drop constraint if exists care_activities_produk_satuan_check;

alter table public.care_activities
  add constraint care_activities_produk_satuan_check
  check (
    produk_satuan is null
    or produk_satuan in ('kg', 'gram', 'liter', 'ml', 'karung', 'tangki')
  );

-- Batas atas 100000 adalah pagar salah ketik (mis. kelebihan nol), bukan
-- batas agronomis. Nol dan negatif ditolak karena "memakai 0 kg" sama saja
-- dengan tidak mencatat takaran -- itu diwakili NULL.
alter table public.care_activities
  drop constraint if exists care_activities_produk_jumlah_check;

alter table public.care_activities
  add constraint care_activities_produk_jumlah_check
  check (
    produk_jumlah is null
    or (produk_jumlah > 0 and produk_jumlah <= 100000)
  );

-- Dua aturan sekaligus:
--   a. produk_jumlah dan produk_satuan harus null bersama atau terisi bersama.
--      Angka tanpa satuan tidak bisa dibaca; satuan tanpa angka tidak berarti.
--   b. Kalau takaran terisi, `produk` wajib ada isinya.
--      Alasan: angka "2 kg" tanpa nama bahan tidak ada artinya.
alter table public.care_activities
  drop constraint if exists care_activities_produk_qty_pair_check;

alter table public.care_activities
  add constraint care_activities_produk_qty_pair_check
  check (
    (produk_jumlah is null and produk_satuan is null)
    or (
      produk_jumlah is not null
      and produk_satuan is not null
      and nullif(btrim(produk), '') is not null
    )
  );

-- Pencarian "baris terakhir untuk tugas X" jadi operasi panas begitu satu
-- tugas boleh punya banyak baris: dipakai update_task_realization di bawah
-- dan setiap kali layar detail tugas dibuka.
--
-- Urutan kolom mengikuti persis order by yang dipakai:
--   order by performed_at desc, id desc
-- `id desc` WAJIB ikut. Tanpa tie-breaker itu, dua baris dengan performed_at
-- identik bikin "terakhir" tidak deterministik.
create index if not exists idx_care_activities_task_latest
  on public.care_activities (care_task_id, performed_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 2. complete_task -- tambah takaran bahan + penjaga anti-selesai-ganda
--
-- Signature lama WAJIB di-drop dulu. `create or replace` dengan parameter
-- ber-default hanya akan membuat OVERLOAD baru, lalu pemanggilan lama jadi
-- ambigu ("function is not unique") -- persis kelas bug yang ditangani
-- migrasi 024. Jangan diulang.
--
-- Signature (uuid, text) sudah di-drop migrasi 032; baris itu diulang di sini
-- sebagai jaring pengaman kalau 032 belum pernah dijalankan penuh di suatu
-- environment. `if exists` membuatnya no-op kalau memang sudah tidak ada.
-- ---------------------------------------------------------------------------

drop function if exists public.complete_task(uuid, text);
drop function if exists public.complete_task(uuid, text, text);

create or replace function public.complete_task(
  p_task_id uuid,
  p_note text default null,
  p_produk text default null,
  p_produk_jumlah numeric default null,
  p_produk_satuan text default null
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
  task_current_status public.task_status;
  clean_note text := nullif(trim(p_note), '');
  clean_produk text := nullif(trim(p_produk), '');
  clean_satuan text := nullif(trim(p_produk_satuan), '');
  new_activity_id uuid;
begin
  select farm_id, assigned_to, status
  into task_farm_id, task_assigned_to, task_current_status
  from public.care_tasks
  where id = p_task_id;

  -- Tiga verifikasi di bawah DIPERTAHANKAN apa adanya dari migrasi 032,
  -- termasuk pesan Inggrisnya, supaya penanganan error di klien tidak berubah.
  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can complete this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can complete tasks';
  end if;

  -- BARU: mencegah baris 'completed' ganda di log.
  -- Tugas yang sudah selesai tidak boleh dicatat ulang; kalau pekerja mau
  -- membetulkan isinya, jalurnya update_task_realization, bukan insert baru.
  -- Tugas berstatus 'postponed' TETAP boleh diselesaikan -- itu alur normal.
  if task_current_status = 'completed' then
    raise exception 'Tugas ini sudah selesai dan tidak bisa dicatat ulang.';
  end if;

  -- Validasi pasangan bahan dijalankan DI SINI, sebelum constraint tabel yang
  -- bicara. Constraint tetap jadi jaring pengaman terakhir, tapi pesannya
  -- ("violates check constraint ...") tidak bisa dibaca pekerja di lapangan.
  if (p_produk_jumlah is not null or clean_satuan is not null)
     and clean_produk is null then
    raise exception 'Nama bahan wajib diisi kalau takaran diisi.';
  end if;

  if (p_produk_jumlah is null) <> (clean_satuan is null) then
    raise exception 'Takaran dan satuan harus diisi berdua.';
  end if;

  -- `asal` sengaja tidak disebut: mengandalkan DEFAULT 'terjadwal' pada kolom,
  -- sama seperti perilaku sebelum migrasi ini. `category` juga tidak diisi --
  -- constraint care_activities_asal_source_check hanya mewajibkan category
  -- untuk cabang 'inisiatif'.
  --
  -- p_note di-trim jadi null persis seperti di update_task_realization, supaya
  -- jalur "catat" dan jalur "perbaiki" menyimpan catatan kosong dengan cara
  -- yang sama. Ini BERBEDA dari migrasi 032 yang menyimpan p_note mentah;
  -- perbedaannya hanya menyentuh catatan yang isinya spasi atau string kosong,
  -- yang sekarang tersimpan NULL alih-alih ''.
  insert into public.care_activities (
    farm_id,
    care_task_id,
    performed_by,
    status,
    note,
    produk,
    produk_jumlah,
    produk_satuan
  )
  values (
    task_farm_id,
    p_task_id,
    current_user_id,
    'completed',
    clean_note,
    clean_produk,
    p_produk_jumlah,
    clean_satuan
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$function$;

-- WAJIB. DROP FUNCTION menghapus grant yang menempel pada fungsi lama.
-- Migrasi 032 hanya menyebut grant ini sebagai catatan verifikasi manual,
-- tidak pernah menulisnya sebagai pernyataan. Tanpa dua baris di bawah,
-- pekerja kena "permission denied" saat menyelesaikan tugas.
revoke execute on function public.complete_task(uuid, text, text, numeric, text)
  from public, anon;

grant execute on function public.complete_task(uuid, text, text, numeric, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_task_realization -- "perbaiki catatan"
--
-- HANYA memperbaiki isi catatan. Tidak menyentuh status, tidak menyentuh
-- performed_at, tidak menyentuh care_tasks sama sekali (lihat alasan di
-- kepala file).
--
-- SECURITY DEFINER: setelah bagian 4 di bawah, `authenticated` tidak lagi
-- punya grant UPDATE pada care_activities, jadi satu-satunya jalan memperbaiki
-- catatan adalah lewat fungsi ini. Itu memang tujuannya -- seluruh aturan
-- "hanya baris terakhir, hanya pencatatnya" hidup di satu tempat, bukan
-- tersebar di policy.
-- ---------------------------------------------------------------------------

create or replace function public.update_task_realization(
  p_activity_id uuid,
  p_note text default null,
  p_produk text default null,
  p_produk_jumlah numeric default null,
  p_produk_satuan text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target public.care_activities%rowtype;
  parent_task public.care_tasks%rowtype;
  latest_activity_id uuid;
  schedule_is_cancelled boolean;
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
  update public.care_activities
  set note = clean_note,
      produk = clean_produk,
      produk_jumlah = p_produk_jumlah,
      produk_satuan = clean_satuan,
      edited_at = now()
  where id = p_activity_id;

  return p_activity_id;
end;
$function$;

revoke execute on function public.update_task_realization(uuid, text, text, numeric, text)
  from public, anon;

grant execute on function public.update_task_realization(uuid, text, text, numeric, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Pengetatan hak akses pada care_activities
--
-- Migrasi 007 hanya memberi `select, insert` secara eksplisit, tetapi default
-- privileges bawaan Supabase memberi ALL pada anon + authenticated untuk tabel
-- baru di schema public. Yang menahan UPDATE/DELETE selama ini semata-mata
-- RLS: tidak ada satu pun policy UPDATE atau DELETE pada tabel ini.
--
-- Pencabutan di bawah TIDAK mengubah perilaku apa pun hari ini. Gunanya
-- menutup permukaan serangan: kalau kelak ada yang menambah policy UPDATE
-- yang longgar, grant-nya sudah tidak ada lagi untuk dipakai.
--
-- Perbaikan catatan tetap jalan karena update_task_realization di atas
-- SECURITY DEFINER -- ia berjalan sebagai pemilik tabel, bukan sebagai
-- `authenticated`.
--
-- service_role SENGAJA TIDAK disentuh (dipakai skrip db-test dan pemeliharaan).
-- Grant pada care_tasks, care_schedules, dan photo_attachments juga tidak
-- disentuh di migrasi ini.
-- ---------------------------------------------------------------------------

revoke update, delete, truncate on public.care_activities
  from anon, authenticated;

-- Signature RPC berubah, jadi cache schema PostgREST wajib dimuat ulang.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. complete_task TIDAK ter-overload -- harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'complete_task';
--
--    -> harus: complete_task(uuid, text, text, numeric, text)
--    -> kalau muncul lebih dari satu baris, drop-nya gagal. STOP.
--
-- 2. Grant execute kembali menempel pada KEDUA fungsi:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('complete_task', 'update_task_realization');
--
--    -> `authenticated` wajib muncul untuk keduanya. Kalau tidak, klien akan
--       kena "permission denied" dan pekerja tidak bisa mencatat apa pun.
--
-- 3. Grant tabel sudah menyempit -- anon/authenticated hanya SELECT + INSERT:
--
--      select grantee, privilege_type
--      from information_schema.role_table_grants
--      where table_name = 'care_activities'
--        and grantee in ('anon', 'authenticated')
--      order by grantee, privilege_type;
--
-- 4. Constraint terpasang dan tervalidasi (convalidated harus true semua):
--
--      select conname, convalidated
--      from pg_constraint
--      where conrelid = 'public.care_activities'::regclass
--        and conname like 'care_activities_produk%';
--
-- 5. Index terbentuk:
--
--      select indexname from pg_indexes
--      where tablename = 'care_activities'
--        and indexname = 'idx_care_activities_task_latest';
--
-- 6. Trigger rantai masih utuh dan urutannya benar (zz_ harus di bawah sync_):
--
--      select t.tgname
--      from pg_trigger t join pg_class c on c.oid = t.tgrelid
--      where c.relname = 'care_activities' and not t.tgisinternal
--      order by t.tgname;
-- ---------------------------------------------------------------------------
