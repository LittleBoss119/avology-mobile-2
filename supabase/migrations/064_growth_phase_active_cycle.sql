-- ===========================================================================
-- 064 -- Fase pertumbuhan disaring ke siklus tanam AKTIF
--
-- MASALAHNYA
--
-- trees.current_growth_phase diisi recalculate_tree_current_growth_phase
-- (023:164-188), yang mengambil catatan fase TERBARU milik sebuah posisi dengan
-- penyaring hanya tree_id dan is_deleted. Tidak ada satu pun penyebutan siklus
-- tanam di dalamnya -- fungsi itu lahir di migrasi 023, dua puluh dua migrasi
-- sebelum tree_plantings ada (055).
--
-- Akibatnya posisi yang ditanami ulang MEWARISI fase pohon sebelumnya. Bibit
-- yang baru ditanam di posisi bekas pohon yang sempat dicatat 'harvesting' akan
-- langsung menyandang fase Panen, dan penghitung "N hari sejak berbunga" di
-- layar detail pohon menghitung dari tanggal milik pohon yang sudah mati.
-- Angka yang salah yang terlihat persis seperti angka yang benar.
--
-- YANG DIKERJAKAN DI SINI
--
--   1. recalculate_tree_current_growth_phase hanya melihat catatan fase yang
--      terjadi pada atau sesudah tanggal mulai siklus AKTIF.
--   2. start_tree_planting memanggil fungsi itu setelah menanam, supaya reset
--      terjadi lewat satu sumber kebenaran -- bukan UPDATE terpisah yang bisa
--      menyimpang dari perhitungan aslinya.
--   3. Backfill: hitung ulang seluruh baris trees supaya data yang sudah
--      terlanjur salah ikut dibetulkan.
--
-- TANPA KOLOM planting_id. growth_phase_records tidak mendapat penanda siklus,
-- dan itu disengaja: menambahkannya berarti mengisi ulang seluruh baris lama
-- dengan tebakan berbasis tanggal juga, cuma sekali dan permanen. Penyaringan
-- berbasis tanggal di bawah menghasilkan jawaban yang sama tanpa membekukan
-- tebakan itu ke dalam data.
--
-- BATASNYA DISEBUT TERUS TERANG: tanpa penanda siklus, satu-satunya penghubung
-- catatan ke siklusnya adalah waktu. Catatan fase yang tanggalnya DIMUNDURKAN
-- melewati batas siklus akan dinilai milik siklus yang salah. Ini pendekatan
-- yang sama -- dan keterbatasan yang sama -- dengan groupTreeHistoryByCycle di
-- sisi klien (src/utils/treeCycle.ts), yang menyebut dirinya sendiri
-- "PERKIRAAN, bukan fakta tersimpan".
--
-- TIDAK MENYENTUH trees.current_condition. Migrasi 055:262-265 dan 055:506-508
-- menyatakan secara eksplisit bahwa kondisi memang TIDAK direset saat siklus
-- ditutup maupun dimulai. Keputusan itu dibiarkan utuh di sini.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. recalculate_tree_current_growth_phase -- disaring ke siklus aktif
--
-- Badan fungsinya DISALIN APA ADANYA dari 023:164-188. Yang bertambah hanya
-- pencarian siklus aktif di atas dan dua baris penyaring di dalam select-nya;
-- urutan (recorded_at desc, created_at desc, id desc), coalesce yang TIDAK ada,
-- dan UPDATE penutupnya dibiarkan persis seperti aslinya.
--
--
-- TIPE KOLOM -- DIPERIKSA LANGSUNG, BUKAN DIINGAT:
--
--   tree_plantings.planted_at      -> date        (055:74, nullable)
--   growth_phase_records.recorded_at -> timestamptz (005:8, not null)
--
-- Keduanya BERBEDA TIPE, jadi perbandingannya tidak boleh dibiarkan implisit.
-- Postgres akan meng-cast date ke timestamptz memakai TimeZone sesi kalau
-- dibiarkan, dan TimeZone sesi pada Supabase adalah UTC -- artinya "tanggal
-- tanam" akan berarti tengah malam UTC, yaitu pukul 07.00 WIB. Catatan fase
-- yang dibuat pada pagi hari penanaman akan jatuh SEBELUM ambangnya dan hilang.
--
-- Karena itu arah cast-nya DIBALIK: recorded_at yang diturunkan ke tanggal
-- kalender WIB, lalu dibandingkan sebagai date lawan date.
--
--   (gpr.recorded_at at time zone 'Asia/Jakarta')::date >= <tanggal mulai>
--
-- Bentuk ini bukan karangan baru. Ia idiom yang sudah dipakai di seluruh basis
-- kode ini setiap kali timestamptz harus bertemu date: 041:112, 046:238,
-- 047:504, 048:184, dan 057:669 semuanya menulis
-- `(performed_at at time zone 'Asia/Jakarta')::date`. Sisi kliennya sepadan --
-- toWibIsoDate() di src/utils/taskDueDate.ts melakukan hal yang sama sebelum
-- membandingkan tanggal.
--
--
-- TANGGAL MULAI SIKLUS = coalesce(planted_at, created_at WIB).
--
-- planted_at boleh NULL: start_tree_planting menerima p_planted_at default null
-- (055:357) dan memasukkannya apa adanya, jadi siklus aktif tanpa tanggal tanam
-- adalah keadaan yang benar-benar bisa ada di data. Tanpa coalesce, ambangnya
-- jadi NULL, seluruh perbandingan bernilai NULL, dan pohon yang siklusnya tidak
-- bertanggal akan kehilangan fasenya sama sekali -- kehilangan data yang
-- terlihat, akibat perbaikan.
--
-- created_at sebagai cadangan karena baris siklus itu sendiri tidak mungkin
-- lahir sebelum siklusnya dimulai. Ini persis cadangan yang sudah dipakai
-- cycleStartKey() di src/utils/treeCycle.ts:183-185, dengan alasan yang sama --
-- bukan aturan kedua yang baru diperkenalkan di sini.
--
--
-- DUA KEADAAN YANG MENGHASILKAN NULL, keduanya lewat jalur yang sama:
--
--   a. Posisi tanpa siklus aktif. active_start tetap NULL, penjaga di bawah
--      melewati select-nya, latest_phase tinggal NULL.
--   b. Siklus aktif ada tapi belum punya catatan fase. Select-nya berjalan dan
--      tidak menemukan baris, latest_phase tetap NULL.
--
-- Keduanya menulis NULL ke kolomnya. Itu memang nilai yang benar: kolom
-- trees.current_growth_phase nullable tanpa default sejak 003, dan "belum
-- dicatat" adalah keadaan sah yang sudah punya tempat di UI.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_tree_current_growth_phase(
  p_tree_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_phase public.growth_phase;
  active_start date;
begin
  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  select coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
  into active_start
  from public.tree_plantings tp
  where tp.tree_id = p_tree_id
    and tp.ended_at is null;

  -- Posisi kosong: tidak ada pohon yang bisa punya fase. Select di bawah
  -- SENGAJA dilewati alih-alih dibiarkan berjalan dengan ambang NULL -- hasilnya
  -- sama, tapi niatnya jadi terbaca dan tidak bergantung pada perilaku NULL.
  if active_start is not null then
    select phase
    into latest_phase
    from public.growth_phase_records
    where tree_id = p_tree_id
      and is_deleted = false
      and (recorded_at at time zone 'Asia/Jakarta')::date >= active_start
    order by recorded_at desc, created_at desc, id desc
    limit 1;
  end if;

  update public.trees
  set current_growth_phase = latest_phase,
      updated_at = now()
  where id = p_tree_id;
end;
$$;

-- Hak akses ditegaskan ulang. `create or replace function` sebetulnya
-- mempertahankan grant yang sudah ada, jadi baris ini bukan perbaikan melainkan
-- penegasan: fungsi ini TIDAK PERNAH dipanggil langsung dari klien. Ia hanya
-- dipanggil dari trigger dan dari fungsi security definer lain. Sepadan dengan
-- 023:701.
revoke execute on function public.recalculate_tree_current_growth_phase(uuid)
  from public, anon;


-- ---------------------------------------------------------------------------
-- 2. start_tree_planting -- mereset fase lewat fungsi yang sama
--
-- Badan fungsinya DISALIN APA ADANYA dari 055:354-416. Yang bertambah tepat
-- satu baris: `perform public.recalculate_tree_current_growth_phase(p_tree_id)`
-- setelah INSERT dan sebelum RETURN. Tanda tangannya (uuid, text, date) dan
-- nilai kembaliannya tidak berubah, jadi `create or replace` sah dan tidak
-- melahirkan overload kedua.
--
-- LEWAT FUNGSI, BUKAN `update trees set current_growth_phase = null`.
-- Menuliskan NULL langsung di sini akan menjadi tempat KEDUA yang memutuskan
-- berapa nilai kolom itu seharusnya, dan tempat kedua adalah tempat yang bisa
-- menyimpang dari tempat pertama. Lewat fungsi, jawabannya selalu jawaban yang
-- sama -- termasuk pada kasus yang tidak terpikirkan saat menulis baris ini,
-- misalnya siklus baru yang tanggal tanamnya dimundurkan ke belakang catatan
-- fase yang sudah ada.
--
-- Penjaga "masih ada siklus aktif" di dalam fungsi ini menjamin baris siklus
-- yang baru di-INSERT adalah satu-satunya yang aktif saat recalculate berjalan,
-- jadi ambang yang dipakainya pasti ambang siklus baru itu.
--
--
-- YANG BELUM TERTUTUP, DAN INI DISEBUT SUPAYA TIDAK HILANG:
--
-- start_tree_planting bukan satu-satunya jalan yang menggeser jendela siklus.
-- Dua RPC lain juga menggesernya dan TIDAK ikut diubah di migrasi ini, karena
-- keduanya di luar yang disetujui untuk migrasi ini:
--
--   * end_tree_planting (055:269) mengisi ended_at. Setelah itu posisinya tidak
--     punya siklus aktif, jadi fungsi di bagian 1 akan menjawab NULL -- tetapi
--     tidak ada yang memanggilnya, sehingga trees.current_growth_phase tetap
--     memegang fase pohon yang baru saja dinyatakan tidak ada.
--   * update_tree_with_planting (056:104) mengubah planted_at siklus aktif.
--     Ambangnya bergeser, hasilnya bisa berubah, dan kolomnya tidak dihitung
--     ulang.
--
-- Ini bukan kemunduran -- pada kedua jalur itu perilakunya persis seperti
-- sebelum migrasi ini. Tapi ia lubang yang tersisa, dan bentuk perbaikannya
-- yang paling benar adalah SATU TRIGGER pada tree_plantings (after insert or
-- update of planted_at, ended_at) yang memanggil recalculate, menggantikan
-- perform manual di bawah. Itu keputusan yang dipegang pemilik repo, bukan
-- diputuskan di sini; rinciannya ada di laporan yang menyertai migrasi ini.
-- ---------------------------------------------------------------------------

create or replace function public.start_tree_planting(
  p_tree_id uuid,
  p_variety text default null,
  p_planted_at date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  tree_farm_id uuid;
  next_cycle_no smallint;
  new_planting_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select farm_id into tree_farm_id
  from public.trees
  where id = p_tree_id;

  if tree_farm_id is null then
    raise exception 'Pohon tidak ditemukan.';
  end if;

  if not public.is_active_owner(tree_farm_id, current_user_id) then
    raise exception 'Hanya pemilik aktif yang dapat memulai siklus tanam.';
  end if;

  if exists (
    select 1
    from public.tree_plantings
    where tree_id = p_tree_id
      and ended_at is null
  ) then
    raise exception
      'Posisi ini masih ditanami. Tutup siklus tanam yang berjalan lebih dulu.';
  end if;

  -- coalesce(max, 0) + 1 menutup kasus posisi yang seluruh siklusnya terhapus.
  select coalesce(max(cycle_no), 0) + 1
  into next_cycle_no
  from public.tree_plantings
  where tree_id = p_tree_id;

  insert into public.tree_plantings (
    tree_id, farm_id, cycle_no, variety, planted_at, created_by
  )
  values (
    p_tree_id,
    tree_farm_id,
    next_cycle_no,
    nullif(btrim(p_variety), ''),
    p_planted_at,
    current_user_id
  )
  returning id into new_planting_id;

  -- BARIS BARU (064). Pohon baru mulai tanpa fase; kalaupun ada catatan fase
  -- yang tanggalnya jatuh di dalam jendela siklus baru ini, fungsinyalah yang
  -- memutuskan, bukan asumsi di sini.
  perform public.recalculate_tree_current_growth_phase(p_tree_id);

  return new_planting_id;
end;
$$;

revoke execute on function public.start_tree_planting(uuid, text, date)
  from public, anon;

grant execute on function public.start_tree_planting(uuid, text, date)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Backfill
--
-- Hitung ulang SELURUH baris trees, bukan hanya yang posisinya pernah ditanami
-- ulang. Dua alasan: aturan penyaringnya berubah untuk semua pohon (catatan
-- fase bertanggal sebelum tanggal tanam kini tidak dihitung, termasuk pada
-- posisi yang baru sekali ditanami), dan jumlah pohon per kebun berada di orde
-- ratusan -- memilah mana yang perlu lebih mahal daripada menghitung semuanya.
--
-- Lewat perform fungsi yang sama, bukan satu UPDATE ... FROM yang mengulang
-- logikanya. Alasannya sama dengan di bagian 2: satu tempat yang memutuskan.
--
-- SATU HAL YANG DIPERIKSA LEBIH DULU, karena ia bisa MENGGAGALKAN migrasi ini
-- seluruhnya: validate_tree_position_trigger (054:306-310) berbunyi pada SETIAP
-- update ke trees, bukan hanya saat posisinya berubah. Ia membandingkan
-- row_position/column_position dengan grid_rows/grid_columns kebunnya dan
-- melempar exception kalau lewat batas. Backfill di bawah menulis ke SELURUH
-- baris trees, jadi satu baris di luar batas sudah cukup untuk membatalkan
-- migrasi ini.
--
-- Diperiksa, dan jalurnya tertutup: set_farm_grid menolak pengecilan selama
-- masih ada pohon di luar ukuran baru (063:114-127), sementara seluruh baris
-- trees yang ada sekarang lahir SESUDAH 054 -- migrasi itu mengosongkan tabel
-- trees (054:135) sebelum memasang kolom grid, dan kedua RPC pembuat pohon
-- memvalidasi posisinya. Jadi tidak ada baris di luar batas yang bisa lahir
-- lewat jalur yang didukung.
--
-- Yang TIDAK bisa dijamin dari sini: grid_rows/grid_columns yang pernah diubah
-- dengan UPDATE langsung ke farms lewat SQL editor, melewati RPC-nya. Kalau itu
-- pernah terjadi, jalankan pemeriksaan ini SEBELUM push -- harus 0:
--
--   select count(*)
--   from public.trees t
--   join public.farms f on f.id = t.farm_id
--   where t.row_position > f.grid_rows
--      or (ascii(t.column_position) - 64) > f.grid_columns;
--
-- EFEK SAMPING YANG DISADARI: fungsi itu selalu menulis updated_at = now(),
-- jadi backfill ini menggeser trees.updated_at untuk setiap baris. Diperiksa:
-- tidak ada satu pun layar yang menampilkan atau mengurutkan berdasarkan
-- trees.updated_at (mapTree membacanya, tidak ada yang memakainya), dan tidak
-- ada trigger yang bergantung padanya. Dibiarkan apa adanya alih-alih menambah
-- cabang "hanya kalau berubah", yang berarti menyalin perhitungannya ke tempat
-- kedua demi menghemat penulisan kolom yang tidak dibaca siapa pun.
--
-- YANG AKAN BERUBAH SETELAH INI DIJALANKAN:
--
--   * Posisi tanpa siklus aktif -> current_growth_phase jadi NULL. Layar detail
--     posisi kosong memang tidak menampilkan tag fase, dan penyaring fase di
--     daftar pohon sudah punya keadaan 'unrecorded' untuk NULL, jadi tidak ada
--     yang patah.
--   * Posisi yang ditanami ulang -> fase pohon lama lepas; jadi NULL sampai
--     pohon barunya benar-benar dicatat fasenya.
--   * Monitoring fase (getFloweringAndFruitingTrees) -> pohon yang tadinya ikut
--     terdaftar karena fase warisan akan hilang dari daftar. Itu perbaikannya,
--     bukan kehilangan.
-- ---------------------------------------------------------------------------

do $$
declare
  tree_row record;
begin
  for tree_row in select id from public.trees loop
    perform public.recalculate_tree_current_growth_phase(tree_row.id);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. Muat ulang cache schema PostgREST
--
-- Tanda tangan start_tree_planting tidak berubah, tetapi definisinya berubah.
-- Reload murah dan konsisten dengan setiap migrasi sejak 051 yang menyentuh
-- fungsi -- terakhir 063:154, dengan alasan yang sama persis.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';


-- ===========================================================================
-- VERIFIKASI MANUAL (jalankan sesudah push; tidak dijalankan otomatis)
--
-- 1. Tidak ada posisi kosong yang masih memegang fase:
--
--      select count(*)
--      from public.trees t
--      where t.current_growth_phase is not null
--        and not exists (
--          select 1 from public.tree_plantings tp
--          where tp.tree_id = t.id and tp.ended_at is null
--        );
--
--    -> harus 0.
--
-- 2. Tidak ada pohon yang fasenya berasal dari catatan sebelum tanggal tanam
--    siklus aktifnya:
--
--      select t.id, t.tree_code, t.current_growth_phase
--      from public.trees t
--      join public.tree_plantings tp
--        on tp.tree_id = t.id and tp.ended_at is null
--      where t.current_growth_phase is not null
--        and not exists (
--          select 1
--          from public.growth_phase_records gpr
--          where gpr.tree_id = t.id
--            and gpr.is_deleted = false
--            and (gpr.recorded_at at time zone 'Asia/Jakarta')::date
--                >= coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
--        );
--
--    -> harus kosong.
--
-- 3. Penanaman ulang mereset fasenya. Pada satu posisi uji:
--
--      select public.end_tree_planting('<tree>', 'mati', current_date);
--      select public.start_tree_planting('<tree>', 'Miki', current_date);
--      select current_growth_phase from public.trees where id = '<tree>';
--
--    -> NULL.
--
-- 4. Kondisi TIDAK ikut direset (dijaga tetap seperti 055):
--
--      select current_condition from public.trees where id = '<tree>';
--
--    -> tetap seperti sebelum end_tree_planting dipanggil.
--
-- 5. Fungsi masih tertutup dari klien:
--
--      select has_function_privilege('authenticated',
--        'public.recalculate_tree_current_growth_phase(uuid)', 'execute');
--
--    -> false.
-- ===========================================================================
