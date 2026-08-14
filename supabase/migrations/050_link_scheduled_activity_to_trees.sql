-- 050_link_scheduled_activity_to_trees.sql
--
-- Pekerjaan terjadwal akhirnya tercatat di riwayat pohon.
--
-- MASALAHNYA: care_activity_trees hanya pernah terisi dari satu jalur, yaitu
-- create_care_activity (027) untuk catatan 'inisiatif'. complete_task tidak
-- pernah menyentuh tabel itu sama sekali. Akibatnya tree_history_view (028) --
-- yang mengambil pohon HANYA lewat jembatan care_activity_trees, bukan lewat
-- care_tasks.target_tree_id -- tidak pernah menampilkan satu pun pekerjaan
-- terjadwal. Riwayat perawatan per pohon selama ini hanya memuat pencatatan
-- inisiatif, dan itu bukan keputusan desain, melainkan lubang.
--
-- PERBAIKANNYA: complete_task menautkan pohon segera setelah baris aktivitas
-- masuk, diturunkan dari target tugas:
--
--   target_type 'tree'   -> satu baris, dari care_tasks.target_tree_id
--   target_type 'farm'   -> semua pohon kebun itu yang is_archived = false
--   target_type 'custom' -> tidak menautkan apa pun
--
-- POHON DIRESOLUSI SAAT PENYELESAIAN, BUKAN SAAT JADWAL DIBUAT. Jadwal
-- berulang bisa lahir berbulan-bulan sebelum dikerjakan, dan daftar pohon
-- kebun berubah di antaranya (pohon baru ditanam, pohon lama diarsipkan).
-- Resolusi di akhir membuat tautan mencerminkan pohon yang benar-benar ada
-- saat pekerjaannya dilakukan.
--
-- PRASYARAT: 046, 047, 048, dan 049 sudah dijalankan dan terverifikasi.
-- Seluruh tabel care_* kosong sejak sebelum 046, jadi TIDAK ADA backfill:
-- tidak ada satu pun baris care_activities lama yang perlu ditautkan surut.
-- target_type yang mungkin tinggal tiga (farm/tree/custom) sejak 047.
--
-- SIGNATURE TIDAK BERUBAH. Daftar pohon diturunkan dari target tugas, bukan
-- dikirim klien, jadi `create or replace` sudah cukup dan tidak ada DROP
-- FUNCTION di migrasi ini. Ini penting: DROP FUNCTION akan ikut membuang grant
-- execute yang menempel (pelajaran 043:220-228), dan tanpa DROP grant-nya utuh
-- sehingga tidak perlu ditulis ulang -- sama seperti perlakuan 047:6c terhadap
-- assign_worker_to_care_schedule.
--
-- Yang SENGAJA TIDAK disentuh: postpone_task, update_task_realization,
-- penyapu 048, create_care_activity, dan segala hal soal keanggotaan.

begin;

-- ===========================================================================
-- 1. Index pada care_activity_trees(tree_id)
--
-- SUDAH ADA sejak 025:61 dengan nama yang sama persis. Pernyataan di bawah
-- karenanya no-op di database yang sehat, dan ditulis semata sebagai jaring
-- pengaman untuk environment yang 025-nya pernah dijalankan sebagian.
--
-- Alasan index ini penting justru mulai sekarang: sebelum migrasi ini tabel
-- jembatan hanya tumbuh satu-dua baris per catatan inisiatif. Dengan target
-- 'farm', SATU tugas selesai menghasilkan sebanyak-jumlah-pohon baris
-- sekaligus, dan kueri arah balik ("pohon ini terakhir dipupuk kapan") menjadi
-- jalur baca utama di tahap berikutnya. Arah sebaliknya (dari aktivitas ke
-- pohon) sudah tertutup oleh primary key (care_activity_id, tree_id).
-- ===========================================================================

create index if not exists idx_care_activity_trees_tree_id
  on public.care_activity_trees(tree_id);

-- ===========================================================================
-- 2. complete_task -- menautkan pohon setelah INSERT aktivitas
--
-- Yang berubah dari 043 HANYA dua hal:
--   a. SELECT awal ikut mengambil target_type dan target_tree_id.
--   b. Blok penautan pohon setelah INSERT ... returning.
-- Seluruh verifikasi, pesan error, penjaga anti-selesai-ganda, validasi
-- pasangan bahan, dan daftar kolom INSERT dipertahankan VERBATIM dari 043
-- supaya penanganan error di klien tidak bergeser sedikit pun.
--
-- Kenapa penautan aman dilakukan di sini:
--   * Fungsi ini SECURITY DEFINER (043:132), jadi ia berjalan sebagai pemilik
--     tabel dan RLS care_activity_trees di-bypass. Policy INSERT 025:104
--     tidak perlu dilonggarkan.
--   * INSERT dan penautan berada dalam satu pemanggilan fungsi, jadi satu
--     transaksi. Kalau penautan gagal, baris aktivitasnya ikut dibatalkan --
--     tidak ada aktivitas yatim tanpa pohon.
--   * validate_care_activity_trigger (030:65-74) berbunyi BEFORE INSERT pada
--     care_activities dan tidak menyentuh jembatan sama sekali.
-- ===========================================================================

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
  task_target_type public.target_type;
  task_target_tree_id uuid;
  clean_note text := nullif(trim(p_note), '');
  clean_produk text := nullif(trim(p_produk), '');
  clean_satuan text := nullif(trim(p_produk_satuan), '');
  new_activity_id uuid;
begin
  -- Dua kolom target ikut diambil di sini, bukan lewat SELECT kedua setelah
  -- INSERT: satu pembacaan baris tugas sudah cukup, dan nilainya tidak mungkin
  -- berubah di tengah transaksi ini.
  select farm_id, assigned_to, status, target_type, target_tree_id
  into task_farm_id, task_assigned_to, task_current_status,
       task_target_type, task_target_tree_id
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

  -- Mencegah baris 'completed' ganda di log (043).
  -- Tugas yang sudah selesai tidak boleh dicatat ulang; kalau pekerja mau
  -- membetulkan isinya, jalurnya update_task_realization, bukan insert baru.
  -- Tugas berstatus 'postponed' TETAP boleh diselesaikan -- itu alur normal.
  --
  -- Penjaga ini sekaligus yang menahan tautan pohon ganda: satu tugas hanya
  -- bisa melahirkan satu baris 'completed', jadi satu himpunan tautan.
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

  -- `asal` sengaja tidak disebut: mengandalkan DEFAULT 'terjadwal' pada kolom.
  -- `category` juga tidak diisi -- constraint care_activities_asal_source_check
  -- hanya mewajibkan category untuk cabang 'inisiatif'.
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

  -- -------------------------------------------------------------------------
  -- BARU: tautkan pohon terdampak ke aktivitas yang baru saja masuk.
  --
  -- `select distinct` mengikuti pola yang sudah terbukti di
  -- create_care_activity (027:107): primary key jembatan adalah
  -- (care_activity_id, tree_id), jadi baris kembar apa pun menggagalkan
  -- seluruh penyelesaian tugas. Di sini sumber datanya sudah unik dengan
  -- sendirinya (trees.id adalah primary key), tetapi distinct-nya
  -- dipertahankan supaya kedua jalur tulis jembatan terbaca sama dan tidak
  -- bergantung pada asumsi tentang sumbernya.
  --
  -- Tidak ada cabang untuk 'custom': targetnya teks bebas, tidak menunjuk
  -- pohon mana pun, jadi tidak ada yang bisa ditautkan. Aktivitasnya tetap
  -- tercatat di care_activities dan tetap terlihat di daftar tugas -- yang
  -- tidak muncul hanya riwayat per pohon, dan memang seharusnya begitu.
  -- -------------------------------------------------------------------------
  if task_target_type = 'tree' then
    -- care_tasks_target_check (047:87) menjamin target_tree_id tidak NULL
    -- untuk target 'tree'. Pemeriksaan di bawah tetap ditulis karena
    -- konsekuensi diamnya buruk: tanpa itu, INSERT dengan tree_id NULL akan
    -- gagal sebagai pelanggaran NOT NULL yang tidak menjelaskan apa pun.
    if task_target_tree_id is null then
      raise exception 'Tugas ini bertarget pohon tetapi tidak menyebut pohon mana.';
    end if;

    -- Salinan validasi 027:68-80: pohon wajib berada di kebun yang sama dengan
    -- aktivitasnya. FK care_tasks.target_tree_id -> trees(id) TIDAK menjamin
    -- ini; tidak ada satu pun constraint yang mengikat target_tree_id ke
    -- farm_id tugas. Kalau tautan lintas kebun terlanjur masuk, ia tidak bisa
    -- dikoreksi -- care_activity_trees sengaja tanpa jalur DELETE (025:67-73).
    -- Karena itu gagal keras di sini lebih baik daripada menautkan diam-diam.
    if not exists (
      select 1
      from public.trees tr
      where tr.id = task_target_tree_id
        and tr.farm_id = task_farm_id
    ) then
      raise exception 'Semua pohon harus berada di kebun yang sama';
    end if;

    insert into public.care_activity_trees (care_activity_id, tree_id)
    select distinct new_activity_id, task_target_tree_id;

  elsif task_target_type = 'farm' then
    -- Pohon yang sudah diarsipkan tidak ikut ditautkan: mengarsipkan pohon
    -- berarti ia tidak lagi bagian dari kebun yang dirawat, dan menautkannya
    -- akan menaruh pekerjaan yang tidak pernah menyentuhnya di riwayatnya.
    --
    -- Validasi "kebun yang sama" tidak perlu ditulis terpisah di cabang ini:
    -- syarat tr.farm_id = task_farm_id ADALAH sumber daftarnya.
    --
    -- Kebun tanpa pohon aktif menghasilkan nol baris. Itu bukan error --
    -- pekerjaannya tetap tercatat, hanya tidak menempel di pohon mana pun.
    insert into public.care_activity_trees (care_activity_id, tree_id)
    select distinct new_activity_id, tr.id
    from public.trees tr
    where tr.farm_id = task_farm_id
      and tr.is_archived = false;
  end if;

  return new_activity_id;
end;
$function$;

-- Grant SENGAJA tidak ditulis ulang: tidak ada DROP FUNCTION di migrasi ini,
-- sehingga grant execute untuk `authenticated` dari 043:227 tetap menempel.
-- Verifikasi nomor 2 di bawah tetap wajib dijalankan untuk memastikannya.

-- Signature tidak berubah, tetapi definisi fungsi berubah. Reload murah dan
-- konsisten dengan seluruh migrasi sebelumnya.
notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. complete_task TIDAK ter-overload -- harus TEPAT SATU baris, dan
--    signature-nya harus SAMA PERSIS seperti sebelum migrasi ini:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'complete_task';
--
--    -> harus: complete_task(uuid, text, text, numeric, text)
--    -> kalau muncul lebih dari satu baris, `create or replace` malah membuat
--       overload dan klien bisa memanggil versi lama. STOP.
--
-- 2. Grant execute masih menempel (harus, karena tidak ada DROP FUNCTION):
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'complete_task';
--
--    -> `authenticated` wajib muncul. Kalau hilang, pekerja kena
--       "permission denied" dan tidak bisa menyelesaikan tugas apa pun:
--       grant execute on function
--         public.complete_task(uuid, text, text, numeric, text) to authenticated;
--
-- 3. Index jembatan ada:
--
--      select indexname from pg_indexes
--      where tablename = 'care_activity_trees';
--
--    -> harus memuat idx_care_activity_trees_tree_id dan
--       care_activity_trees_pkey.
--
-- 4. ALUR NYATA target 'tree' -- ini inti migrasinya, jangan dilewat.
--    Lewat aplikasi: buat jadwal bertarget satu pohon, tugaskan ke pekerja,
--    selesaikan sebagai pekerja itu. Lalu:
--
--      select cat.tree_id
--      from public.care_activity_trees cat
--      join public.care_activities ca on ca.id = cat.care_activity_id
--      where ca.care_task_id = '<task uuid>';
--
--    -> tepat SATU baris, dan tree_id-nya sama dengan care_tasks.target_tree_id.
--
-- 5. ALUR NYATA target 'farm'. Buat jadwal bertarget kebun dan selesaikan.
--
--      select count(*)
--      from public.care_activity_trees cat
--      join public.care_activities ca on ca.id = cat.care_activity_id
--      where ca.care_task_id = '<task uuid>';
--
--    -> harus sama dengan:
--
--      select count(*) from public.trees
--      where farm_id = '<farm uuid>' and is_archived = false;
--
--    Uji juga arsipnya benar-benar dikecualikan: arsipkan satu pohon lebih
--    dulu, lalu selesaikan tugas, dan pastikan pohon itu TIDAK muncul.
--
-- 6. ALUR NYATA target 'custom'. Selesaikan tugas bertarget custom.
--
--      select count(*)
--      from public.care_activity_trees cat
--      join public.care_activities ca on ca.id = cat.care_activity_id
--      where ca.care_task_id = '<task uuid>';
--
--    -> harus 0, dan penyelesaian tugasnya TETAP berhasil.
--
-- 7. Riwayat pohon akhirnya memuat pekerjaan terjadwal -- ini yang dilihat
--    pengguna. Sebagai owner kebun:
--
--      select history_type, asal, title, happened_at
--      from public.tree_history_view
--      where tree_id = '<tree uuid>'
--      order by happened_at desc;
--
--    -> harus ada baris history_type = 'care' dengan asal = 'terjadwal'.
--       Sebelum migrasi ini, baris semacam itu MUSTAHIL muncul.
--       Catatan visibilitas (028): view ini security_invoker, jadi pekerja
--       hanya melihat aktivitas miliknya sendiri. Uji sebagai owner.
--
-- 8. Rantai jadwal berulang tidak ikut rusak. Selesaikan tugas dari jadwal
--    berulang dan pastikan penerusnya tetap lahir. create_successor_schedule
--    (048) menelan exception-nya sendiri, jadi rantai yang rusak TIDAK muncul
--    sebagai error di aplikasi -- cek log Postgres untuk 'Rantai jadwal gagal'.
--
-- 9. Jalur inisiatif tidak tersentuh: catat perawatan inisiatif multi-pohon
--    lewat create_care_activity dan pastikan jembatannya tetap terisi seperti
--    biasa.
-- ===========================================================================
