-- 062_bulk_tree_creation.sql
--
-- Membuat banyak posisi tanam sekaligus dalam SATU transaksi.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- create_tree_with_planting (055:4a) menerima TEPAT SATU posisi. Mengisi kebun
-- 234 posisi lewatnya berarti 234 panggilan RPC terpisah, dan setiap panggilan
-- adalah transaksinya sendiri -- klien Supabase tidak bisa membungkus banyak
-- statement dalam satu transaksi, alasan yang sudah dicatat 055:4a dan 027.
--
-- Gagal di panggilan ke-100 karenanya meninggalkan 99 baris trees yang berdiri
-- sendiri, dan dua hal di bawah ini menjadikan sisa itu PERMANEN:
--
--   * prevent_tree_delete_trigger (006:416) menolak SETIAP delete ke trees.
--     Tidak ada jalur hapus dari aplikasi. 054 harus melumpuhkan trigger itu
--     sementara untuk pekerjaannya sendiri (054:133) -- itu ukuran seberapa
--     keras penjagaannya.
--
--   * trees_unique_code_per_farm (054:248) TIDAK partial, jadi mengarsipkan
--     baris sisa tidak membebaskan kodenya. Posisi '3-A' yang terlanjur lahir
--     lalu diarsipkan tetap menempati '3-A' selamanya.
--
-- Jadi kegagalan separuh jalan bukan gangguan yang bisa dibersihkan; ia
-- kerusakan yang tidak bisa dikoreksi dari dalam aplikasi. Migrasi ini
-- memindahkan seluruh himpunan ke satu transaksi supaya keadaan itu tidak bisa
-- lahir.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK IKUT -- PENANAMAN ULANG MASSAL
--
-- Fungsi ini HANYA melayani posisi yang BELUM PERNAH ditanami, yaitu posisi
-- yang belum punya baris trees sama sekali.
--
-- Menanami ulang posisi yang siklusnya sudah ditutup adalah operasi yang
-- BERBEDA, bukan cabang dari yang ini:
--
--   posisi belum pernah ditanami    posisi bersiklus tertutup
--   ----------------------------    -------------------------
--   create_trees_at_positions       start_tree_planting (055:4c)
--   masukan: kode posisi            masukan: tree_id -- barisnya sudah ada
--   baris trees DIBUAT              baris trees DIPAKAI ULANG
--   cycle_no selalu 1               cycle_no = max + 1
--   dijaga trees_unique_code_...    dijaga tree_plantings_one_active_per_tree
--
-- Masukannya berbeda, constraint yang menjaganya berbeda, dan baris yang lahir
-- berbeda. Menyatukannya berarti satu fungsi dengan dua mode yang tidak berbagi
-- apa pun kecuali namanya. Penanaman ulang sudah punya jalurnya sendiri
-- satu-per-satu lewat StartTreePlantingSheet, dan versi massalnya -- kalau
-- kelak dibutuhkan -- adalah fungsi tersendiri.
--
-- TIDAK ADA parameter, kolom kembalian, maupun cabang di bawah yang disiapkan
-- untuknya. Itu disengaja: parameter yang menganggur adalah janji yang belum
-- tentu ditepati bentuknya.
--
-- ---------------------------------------------------------------------------
-- create_tree_with_planting TETAP HIDUP
--
-- Fungsi 055:4a TIDAK diubah, TIDAK di-drop, dan TIDAK dibungkus. Layar tambah
-- pohon satu-satu terus memakainya apa adanya.
--
-- Dua alasan ia tidak dipensiunkan:
--
--   * Ia mengembalikan tree_id tunggal, yang dipakai layar itu untuk mengunggah
--     foto utama lalu berpindah ke detail pohon. Fungsi di bawah mengembalikan
--     laporan, bukan satu id -- bentuk yang salah untuk pemanggil itu.
--
--   * Ia satu-satunya jalur yang boleh MELEMPAR saat posisinya bentrok. Fungsi
--     di bawah justru MENYARING bentrokan lalu melaporkannya, karena himpunan
--     ratusan posisi yang gugur seluruhnya gara-gara satu posisi terisi adalah
--     perilaku yang tidak berguna bagi pemakainya.
--
-- Keduanya menulis dua tabel yang sama dengan aturan yang sama. Kalau salah
-- satu berubah, yang lain HARUS diperiksa -- tidak ada penjaga otomatis untuk
-- itu, dan itu harga yang diterima sadar.
--
-- ---------------------------------------------------------------------------
-- PRASYARAT
--
--   * 054, 055, dan 056 sudah dijalankan dan terverifikasi. Khususnya:
--     - validate_tree_position_trigger AKTIF (054:306). Fungsi di bawah
--       menyaring dengan aturan yang SAMA supaya trigger tidak pernah punya
--       alasan melempar, tapi ia tetap penjaga terakhirnya dan tidak boleh
--       dilumpuhkan.
--     - grant INSERT pada trees SUDAH DICABUT dari authenticated (056:2).
--       Fungsi di bawah SECURITY DEFINER, jadi ia melewatinya -- itu memang
--       maksudnya, sama seperti create_tree_with_planting.
--
-- YANG SENGAJA TIDAK DISENTUH
--
--   * Tabel, kolom, enum, constraint, index, dan trigger. NOL perubahan skema.
--     Migrasi ini menambah TEPAT SATU fungsi dan tidak lebih.
--   * create_tree_with_planting, start_tree_planting, update_tree_with_planting,
--     end_tree_planting. Nol perubahan.
--   * trees.is_archived. Posisi berarsip TETAP dihitung menempati kodenya --
--     lihat bagian 3c. Jalur pengarsipan tidak disentuh.
--   * Kondisi pohon dan fase pertumbuhan. Baris trees baru memakai default
--     kolomnya ('healthy', NULL), sama persis dengan create_tree_with_planting.
--   * Foto. Pengunggahan foto berada di luar transaksi ini, sama seperti di
--     layar tambah pohon satu-satu.

begin;

-- ===========================================================================
-- 1. create_trees_at_positions
--
-- NAMA. Bukan `create_trees_with_planting` -- versi jamak yang berbeda SATU
-- HURUF dari fungsi yang sudah ada. Nama sedekat itu mengiklankan "hal yang
-- sama, jamak", padahal kontraknya berbeda di tiga hal sekaligus: masukannya
-- kode posisi bukan koordinat terpisah, ia menyaring alih-alih melempar, dan
-- ia mengembalikan laporan alih-alih satu id. Yang membedakannya adalah
-- MASUKANNYA, jadi itu yang dinamai -- bentuk yang sama dengan
-- filter_trees_with_active_planting (057:278) dan set_farm_grid (054:5).
--
-- ---------------------------------------------------------------------------
-- BENTUK MASUKAN POSISI: text[] berisi kode posisi kanonik, mis. '12-C'.
--
-- Bukan dua array paralel (smallint[] + text[]), dan bukan jsonb.
--
--   * Dua array paralel bisa berbeda panjang, dan tidak ada satu pun cara
--     menyatakan "keduanya harus sepanjang" selain memeriksanya lalu melempar.
--     Ia juga memaksa klien MEMECAH kode yang sudah utuh di tangannya.
--
--   * jsonb tidak punya satu pun preseden sebagai parameter RPC di repo ini;
--     seluruh masukan jamak yang ada memakai array bertipe (p_tree_ids uuid[]
--     di 027:45 dan 057:346). Memakainya di sini akan jadi bentuk yang harus
--     dihafal tanpa alasan yang menuntutnya.
--
--   * Kode posisi adalah SATU-SATUNYA penanda yang dimiliki sel kosong di peta.
--     Sel kosong tidak punya tree_id -- barisnya memang belum ada. Kunci sel di
--     src/components/farm-map-screen.tsx dirakit sebagai
--     `${rowNumber}-${columnLetter(columnNumber)}`, dan tree_code adalah kolom
--     GENERATED `row_position::text || '-' || column_position` (054:237). Kedua
--     sisi menghasilkan string yang SAMA PERSIS. Klien mengirim apa yang sudah
--     dipegangnya, tanpa menguraikan apa pun.
--
--   * Laporan penolakan karenanya bisa menyebut posisi dengan string yang
--     PERSIS dibaca pengguna di sel peta. Tidak ada penerjemahan di antaranya.
--
-- KENAPA KETAT, TIDAK DINORMALKAN. Kode di luar bentuk kanonik DITOLAK, bukan
-- dirapikan. '012-C' akan lahir sebagai tree_code '12-C', dan '12-c' akan
-- ditolak trees_column_position_check (054:224). Dua-duanya berarti klien
-- menerima "berhasil" untuk kode yang berbeda dari yang ia kirim, lalu
-- mencocokkan laporan dengan selnya dan gagal. Peta tidak pernah menghasilkan
-- bentuk non-kanonik, jadi ketat tidak berbiaya apa pun bagi pemanggil yang
-- benar -- dan menangkap pemanggil yang salah.
--
-- ---------------------------------------------------------------------------
-- BATAS JUMLAH: 25.974, yaitu 999 x 26.
--
-- Angka ini DITURUNKAN, bukan dipilih: farms_grid_rows_check membatasi baris
-- 1..999 dan farms_grid_columns_check membatasi kolom 1..26 (054:170, 054:177),
-- jadi tidak ada kebun yang bisa memuat lebih dari 25.974 posisi. Permintaan
-- yang lebih besar dari itu sudah pasti salah -- setiap kelebihannya akan
-- ditolak sebagai di luar petak.
--
-- Ini pagar terhadap muatan yang tidak masuk akal, BUKAN batas produk. Ia
-- sengaja tidak lebih kecil: batas yang lebih rendah akan diam-diam mencabut
-- jaminan satu-transaksi persis pada himpunan besar -- himpunan yang paling
-- membutuhkannya -- dan memaksa klien memecah panggilan, yang mengembalikan
-- kegagalan separuh jalan lewat pintu belakang.
--
-- APA YANG TIDAK DIJAGANYA: statement timeout. Nilai statement_timeout untuk
-- role `authenticated` di proyek ini tidak bisa diperiksa dari repo -- ia
-- konfigurasi dasbor Supabase. Panggilan yang sangat besar bisa habis waktu.
-- Kalau itu terjadi, seluruh transaksi ter-rollback dan NOL baris tertinggal --
-- kegagalan yang aman, yang memang jaminan migrasi ini.
--
-- ---------------------------------------------------------------------------
-- KALAU TIDAK ADA SATU PUN POSISI YANG SAH: kembalikan laporan kosong, JANGAN
-- melempar. Ini BERBEDA dari create_manual_schedule (057:441), yang melempar
-- 'Tidak ada pohon yang bisa dijadwalkan...' pada keadaan yang setara.
--
-- Perbedaannya disengaja, dan alasannya ada pada apa yang dilindungi exception
-- itu:
--
--   * Di 057, exception mencegah baris care_schedules LAHIR tanpa satu pun
--     pohon di jembatannya -- jadwal yang tidak menunjuk apa pun. Ada sesuatu
--     yang rusak kalau ia tidak melempar.
--
--   * Di sini, nol posisi sah berarti nol baris ditulis. Transaksinya sudah
--     tidak berbuat apa-apa. Yang dihancurkan exception justru LAPORANNYA:
--     PostgREST mengubahnya jadi galat, dan klien kehilangan daftar posisi mana
--     yang ditolak dan kenapa -- padahal itu satu-satunya hal berguna yang bisa
--     ia sampaikan ke pengguna pada keadaan itu.
--
-- Exception di sini akan membuang informasi tanpa mencegah apa pun.
--
-- ---------------------------------------------------------------------------
-- BENTUK KEMBALIAN: satu baris, satu array per ALASAN.
--
-- Mengikuti 057 dalam polanya (satu baris; yang berhasil dan yang ditolak
-- sama-sama sebagai array), TIDAK mengikutinya dalam `rejected_message text`.
--
-- 057 punya satu alasan penolakan, jadi satu kalimat cukup. Di sini alasannya
-- EMPAT dan bisa bercampur dalam satu panggilan; satu kalimat gabungan akan
-- memaksa klien mengurai kembali teks yang baru saja dirakit database. Repo ini
-- juga menaruh label di sisi aplikasi, bukan di database -- lihat catatan di
-- farm-map-screen.tsx bahwa peta memegang pemetaan RUPA, bukan daftar label,
-- dan bahwa teks kondisi tetap milik formatTreeCondition. Database
-- mengembalikan FAKTA per alasan; kalimatnya dirakit yang menampilkan.
--
-- KETIGA EMBER PENOLAKAN SALING LEPAS. Satu kode masuk ke TEPAT SATU ember,
-- karena penyaringannya berlapis: bentuk -> petak -> keterisian, masing-masing
-- hanya menerima sisa lapisan sebelumnya. Kode cacat bentuk tidak bisa
-- diperiksa terhadap petak, dan kode di luar petak tidak perlu diperiksa
-- keterisiannya.
--
-- duplicate_codes BUKAN ember penolakan, dan sengaja dinamai supaya tidak
-- terbaca begitu: kode yang dikirim dua kali TETAP DIBUAT satu kali, dan muncul
-- juga di created_codes. Ia dilaporkan karena klien yang mengira mengirim N
-- posisi berhak tahu kenapa yang lahir kurang dari N.
--
-- DEDUPLIKASI WAJIB, BUKAN KERAPIAN. Dua kode identik sama-sama lolos
-- pemeriksaan keterisian -- keduanya belum ada di trees saat diperiksa -- lalu
-- INSERT-nya sendiri melanggar trees_unique_code_per_farm dan MEMECAHKAN
-- SELURUH TRANSAKSI. Tanpa langkah 3a, satu ketukan ganda di peta membatalkan
-- pembuatan 196 pohon.
-- ===========================================================================

create or replace function public.create_trees_at_positions(
  p_farm_id uuid,
  p_position_codes text[],
  p_variety text default null,
  p_planted_at date default null
)
returns table (
  created_tree_ids     uuid[],
  created_codes        text[],
  rejected_occupied    text[],
  rejected_out_of_grid text[],
  rejected_malformed   text[],
  duplicate_codes      text[],
  blank_count          integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  farm_rows       smallint;
  farm_columns    smallint;
  v_input_count   integer;
  v_unique        text[] := '{}'::text[];
  v_duplicated    text[] := '{}'::text[];
  v_blank         integer := 0;
  v_malformed     text[] := '{}'::text[];
  v_well_formed   text[] := '{}'::text[];
  v_out_of_grid   text[] := '{}'::text[];
  v_in_grid       text[] := '{}'::text[];
  v_occupied      text[] := '{}'::text[];
  v_valid         text[] := '{}'::text[];
  v_created_ids   uuid[] := '{}'::uuid[];
  v_created_codes text[] := '{}'::text[];
begin
  -- -------------------------------------------------------------------------
  -- 2a. Penjaga akses -- VERBATIM dari create_tree_with_planting (055:4a).
  --
  -- Kedua pesannya sengaja sama kata demi kata: sisi aplikasi sudah menangani
  -- galat dari fungsi itu, dan pesan baru berarti cabang penanganan baru untuk
  -- keadaan yang persis sama.
  -- -------------------------------------------------------------------------
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Hanya pemilik aktif yang dapat menambah pohon.';
  end if;

  -- -------------------------------------------------------------------------
  -- 2b. Pagar ukuran. Lihat penurunan angkanya di kepala bagian 1.
  -- -------------------------------------------------------------------------
  v_input_count := coalesce(array_length(p_position_codes, 1), 0);

  if v_input_count > 25974 then
    raise exception
      'Terlalu banyak posisi dalam satu permintaan: %. Batasnya 25974 posisi, yaitu ukuran kebun terbesar yang mungkin (999 x 26).',
      v_input_count;
  end if;

  -- -------------------------------------------------------------------------
  -- 2c. Ukuran petak, dibaca SEKALI.
  --
  -- Aturan yang sama dipakai validate_tree_position() (054:276-300), dan itu
  -- memang maksudnya: penyaringan di bawah harus memutuskan hal yang persis
  -- sama dengan trigger, supaya trigger tidak pernah punya alasan melempar.
  --
  -- Penjaga 'kebun tidak ditemukan' ada di sini walau is_active_owner sudah
  -- lolos: pesan trigger ('Kebun untuk pohon ini tidak ditemukan.') muncul di
  -- tengah insert massal tanpa menyebut kebun mana, sedangkan yang ini berbunyi
  -- sebelum satu baris pun disentuh.
  -- -------------------------------------------------------------------------
  select f.grid_rows, f.grid_columns
  into farm_rows, farm_columns
  from public.farms f
  where f.id = p_farm_id;

  if farm_rows is null then
    raise exception 'Kebun tidak ditemukan.';
  end if;

  -- -------------------------------------------------------------------------
  -- 3a. Kosong dan duplikat.
  --
  -- NULL dan string yang hanya berisi spasi DIHITUNG, tidak didaftar: '   '
  -- yang dicetak balik ke pengguna tidak memberitahunya apa pun. Perlakuan yang
  -- sama dengan v_unknown_count di 057:462 -- yang tidak bisa disebut, dihitung.
  -- -------------------------------------------------------------------------
  select count(*)
  into v_blank
  from unnest(coalesce(p_position_codes, '{}'::text[])) as t(code)
  where t.code is null or btrim(t.code) = '';

  select coalesce(array_agg(distinct t.code), '{}'::text[])
  into v_unique
  from unnest(coalesce(p_position_codes, '{}'::text[])) as t(code)
  where t.code is not null and btrim(t.code) <> '';

  select coalesce(array_agg(d.code order by d.code), '{}'::text[])
  into v_duplicated
  from (
    select t.code
    from unnest(coalesce(p_position_codes, '{}'::text[])) as t(code)
    where t.code is not null and btrim(t.code) <> ''
    group by t.code
    having count(*) > 1
  ) d;

  -- -------------------------------------------------------------------------
  -- 3b. Bentuk kode.
  --
  -- '^[1-9][0-9]{0,2}-[A-Z]$' menegakkan ketiga aturan sekaligus, dan tiap
  -- bagiannya punya pasangannya di skema:
  --
  --   [1-9][0-9]{0,2}  -> 1..999 tanpa nol di depan. Batas atasnya sepadan
  --                       dengan trees_row_position_check (054:222); larangan
  --                       nol di depan bukan dari skema melainkan dari
  --                       kekanonikan -- lihat kepala bagian 1.
  --   [A-Z]            -> tepat satu huruf kapital, sepadan dengan
  --                       trees_column_position_check (054:224).
  --
  -- Karena regex ini lolos lebih dulu, split_part(...)::smallint di bagian 3c
  -- dan 4 tidak mungkin melimpah dan tidak mungkin gagal parse.
  -- -------------------------------------------------------------------------
  select coalesce(array_agg(t.code order by t.code), '{}'::text[])
  into v_malformed
  from unnest(v_unique) as t(code)
  where t.code !~ '^[1-9][0-9]{0,2}-[A-Z]$';

  select coalesce(array_agg(t.code), '{}'::text[])
  into v_well_formed
  from unnest(v_unique) as t(code)
  where t.code ~ '^[1-9][0-9]{0,2}-[A-Z]$';

  -- -------------------------------------------------------------------------
  -- 3c. Rentang terhadap petak, lalu keterisian.
  --
  -- Perhitungan kolomnya DITULIS SAMA dengan validate_tree_position() (054:294):
  -- ascii(huruf) - 64, karena 'A' ada di posisi 65 tabel ASCII. Ditulis dengan
  -- cara yang sama supaya keduanya terbaca sebagai satu aturan.
  --
  -- Keterisian membaca SELURUH baris trees kebun itu, TANPA menyaring
  -- is_archived. trees_unique_code_per_farm (054:248) tidak partial, jadi baris
  -- berarsip tetap menempati kodenya; menyaringnya keluar akan membuat fungsi
  -- ini menganggap posisi itu bebas lalu menabrak constraint saat insert.
  --
  -- Pembandingannya lewat tree_code, kolom GENERATED itu sendiri -- bukan lewat
  -- perakitan ulang row_position dan column_position. Dengan begitu sisi kiri
  -- dan sisi kanan pencocokan berasal dari sumber yang sama.
  -- -------------------------------------------------------------------------
  select coalesce(
           array_agg(t.code order by split_part(t.code, '-', 1)::smallint,
                                     split_part(t.code, '-', 2)),
           '{}'::text[]
         )
  into v_out_of_grid
  from unnest(v_well_formed) as t(code)
  where split_part(t.code, '-', 1)::smallint > farm_rows
     or (ascii(split_part(t.code, '-', 2)) - 64) > farm_columns;

  select coalesce(array_agg(t.code), '{}'::text[])
  into v_in_grid
  from unnest(v_well_formed) as t(code)
  where split_part(t.code, '-', 1)::smallint <= farm_rows
    and (ascii(split_part(t.code, '-', 2)) - 64) <= farm_columns;

  select coalesce(
           array_agg(t.code order by split_part(t.code, '-', 1)::smallint,
                                     split_part(t.code, '-', 2)),
           '{}'::text[]
         )
  into v_occupied
  from unnest(v_in_grid) as t(code)
  where exists (
    select 1
    from public.trees tr
    where tr.farm_id = p_farm_id
      and tr.tree_code = t.code
  );

  select coalesce(
           array_agg(t.code order by split_part(t.code, '-', 1)::smallint,
                                     split_part(t.code, '-', 2)),
           '{}'::text[]
         )
  into v_valid
  from unnest(v_in_grid) as t(code)
  where not exists (
    select 1
    from public.trees tr
    where tr.farm_id = p_farm_id
      and tr.tree_code = t.code
  );

  -- -------------------------------------------------------------------------
  -- 4. SATU STATEMENT, DUA TABEL.
  --
  -- Data-modifying CTE, bukan perulangan. Postgres menjamin statement yang
  -- ditulis di dalam WITH dijalankan TEPAT SEKALI dan SAMPAI SELESAI, terlepas
  -- dari apakah kueri utama membaca hasilnya -- jadi new_plantings tetap jalan
  -- walau kueri penutup hanya membaca new_trees.
  --
  -- KENAPA BENTUK INI CUKUP DI SINI, DAN TIDAK AKAN CUKUP KALAU KONTRAKNYA
  -- BERUBAH. Urutan baris yang keluar dari RETURNING tidak dijamin sepadan
  -- dengan urutan masukan. Itu tidak jadi masalah karena SELURUH himpunan
  -- berbagi SATU varietas dan SATU tanggal tanam: tidak ada yang perlu
  -- dipasangkan kembali. Kalau kelak varietas per posisi dibutuhkan, bentuk ini
  -- TIDAK BISA sekadar ditambal -- ia butuh join eksplisit pada kodenya.
  --
  -- created_codes diambil dari kolom tree_code hasil RETURNING, yaitu nilai
  -- GENERATED yang benar-benar tersimpan -- bukan rakitan ulang dari kode
  -- masukan. Dengan begitu yang dilaporkan ke klien adalah kode yang sungguh
  -- ada di database.
  --
  -- nullif(btrim(p_variety), '') sepadan dengan create_tree_with_planting
  -- (055:4a) dan start_tree_planting (055:4c): varietas kosong tersimpan
  -- sebagai NULL, bukan ''.
  --
  -- cycle_no selalu 1. Posisi ini baru lahir; ia tidak punya siklus sebelumnya
  -- yang bisa dihitung, dan itulah tepatnya batas lingkup migrasi ini.
  -- -------------------------------------------------------------------------
  with new_trees as (
    insert into public.trees (farm_id, row_position, column_position)
    select
      p_farm_id,
      split_part(t.code, '-', 1)::smallint,
      split_part(t.code, '-', 2)
    from unnest(v_valid) as t(code)
    returning id, row_position, column_position, tree_code
  ),
  new_plantings as (
    insert into public.tree_plantings (
      tree_id, farm_id, cycle_no, variety, planted_at, created_by
    )
    select
      nt.id,
      p_farm_id,
      1,
      nullif(btrim(p_variety), ''),
      p_planted_at,
      current_user_id
    from new_trees nt
    returning tree_id
  )
  select
    coalesce(
      array_agg(nt.id order by nt.row_position, nt.column_position, nt.id),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(nt.tree_code order by nt.row_position, nt.column_position, nt.id),
      '{}'::text[]
    )
  into v_created_ids, v_created_codes
  from new_trees nt;

  return query
    select
      v_created_ids,
      v_created_codes,
      v_occupied,
      v_out_of_grid,
      v_malformed,
      v_duplicated,
      v_blank;
end;
$$;

-- ===========================================================================
-- 5. Hak akses -- pola 055:4a, tanpa satu pun penyimpangan.
--
-- SECURITY DEFINER di atas adalah yang membuat fungsi ini bisa menulis ke trees
-- padahal grant INSERT sudah dicabut dari authenticated (056:2). Itu memang
-- maksudnya: pembuatan pohon hanya boleh lewat jalur yang menjamin siklus
-- tanamnya ikut lahir dalam transaksi yang sama.
-- ===========================================================================

revoke execute on function public.create_trees_at_positions(uuid, text[], text, date)
  from public, anon;

grant execute on function public.create_trees_at_positions(uuid, text[], text, date)
  to authenticated;

-- ===========================================================================
-- 6. Muat ulang cache schema PostgREST
--
-- Satu fungsi baru yang akan dipanggil klien.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- CATATAN JUJUR -- BALAPAN YANG TERSISA
--
-- Penyaringan di bagian 3 dan INSERT di bagian 4 adalah statement yang berbeda.
-- Pada isolasi READ COMMITTED masing-masing mengambil snapshot-nya sendiri,
-- jadi dua keadaan berikut secara teori masih mungkin:
--
--   * Owner lain memanggil set_farm_grid (054:5) dan MENGECILKAN petak setelah
--     bagian 2c membaca grid_rows/grid_columns. Trigger lalu melempar.
--   * Owner lain membuat pohon di salah satu posisi yang baru saja lolos
--     pemeriksaan keterisian di 3c. trees_unique_code_per_farm lalu melempar.
--
-- Keduanya menuntut dua sesi pemilik aktif menulis kebun yang sama dalam
-- hitungan detik yang sama. TIDAK ADA penguncian baris yang dipasang untuk
-- mencegahnya: repo ini tidak punya satu pun preseden penguncian eksplisit, dan
-- migrasi ini bukan tempat memperkenalkannya.
--
-- Yang penting: pada kedua keadaan itu SELURUH transaksi ter-rollback dan NOL
-- baris tertinggal. Kegagalannya bersih -- persis jaminan yang dibeli migrasi
-- ini. Yang hilang hanyalah laporan penolakan yang rapi, digantikan galat
-- Postgres. Itu pertukaran yang diterima sadar, bukan yang terlewat.
--
-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Fungsi ada, TEPAT SATU signature, dan SECURITY DEFINER:
--
--      select p.oid::regprocedure, p.prosecdef
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='create_trees_at_positions';
--
--    -> satu baris: create_trees_at_positions(uuid, text[], text, date),
--       prosecdef = true. Kalau ada DUA baris, ada overload dan PostgREST akan
--       bingung memilih (pelajaran 024). STOP.
--
-- 2. Grant benar:
--
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'create_trees_at_positions';
--
--    -> `authenticated` wajib muncul. `anon` dan `public` tidak boleh.
--
-- 3. TIDAK ADA YANG LAIN BERUBAH. Migrasi ini menambah satu fungsi dan tidak
--    lebih; ketiga kueri ini harus menghasilkan yang sama seperti sebelum push:
--
--      select p.oid::regprocedure from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public'
--         and p.proname in ('create_tree_with_planting','start_tree_planting',
--                           'end_tree_planting','update_tree_with_planting')
--       order by 1;
--      -> keempatnya masih ada, satu signature masing-masing.
--
--      select tgname, tgenabled from pg_trigger
--       where tgrelid='public.trees'::regclass and not tgisinternal
--       order by tgname;
--      -> validate_tree_position_trigger, prevent_tree_delete_trigger, dan
--         set_trees_updated_at, KETIGANYA tgenabled = 'O'. Kalau ada yang 'D',
--         ia lumpuh -- STOP.
--
--      select privilege_type from information_schema.role_table_grants
--       where table_schema='public' and table_name='trees'
--         and grantee='authenticated' order by 1;
--      -> tetap TEPAT 'SELECT' dan 'UPDATE'. INSERT tidak boleh muncul.
--
-- 4. INTI MIGRASI -- SIKLUS IKUT LAHIR UNTUK SETIAP POHON. Sebagai owner aktif
--    di kebun uji berukuran 26 x 9, pada posisi yang masih kosong:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['1-A','2-A','3-A'], 'Alpukat Mentega', current_date);
--
--    -> created_codes = {1-A,2-A,3-A}, seluruh ember penolakan kosong,
--       blank_count 0. Lalu, dengan kebun yang sama:
--
--      select tr.tree_code, count(tp.id) as jumlah_siklus,
--             min(tp.cycle_no) as cycle_min, max(tp.cycle_no) as cycle_max,
--             bool_and(tp.ended_at is null) as semua_aktif
--      from public.trees tr
--      left join public.tree_plantings tp on tp.tree_id = tr.id
--      where tr.farm_id = '<farm>' and tr.tree_code in ('1-A','2-A','3-A')
--      group by tr.tree_code order by tr.tree_code;
--
--    -> tiga baris, jumlah_siklus = 1 masing-masing, cycle_min = cycle_max = 1,
--       semua_aktif = true. Pohon dengan jumlah_siklus = 0 berarti CTE bagian 4
--       tidak menjalankan new_plantings -- kerusakan terparah yang bisa lahir
--       dari migrasi ini, dan ia TIDAK BISA dikoreksi karena baris trees tidak
--       bisa dihapus. STOP dan jangan bangun apa pun di atasnya.
--
-- 5. JUMLAH YANG LAHIR TEPAT SEBANYAK YANG DILAPORKAN. Sebelum tiap panggilan:
--
--      select count(*) from public.trees where farm_id='<farm>';
--      select count(*) from public.tree_plantings where farm_id='<farm>';
--
--    Sesudahnya, KEDUANYA harus naik tepat array_length(created_tree_ids, 1) --
--    tidak lebih, tidak kurang, dan naiknya harus sama besar.
--
-- 6. PENYARING BEKERJA, TRIGGER TIDAK PERNAH MELEMPAR. Di kebun 26 x 9, kirim
--    posisi cacat bersama posisi yang sah dalam satu panggilan:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['1-B','27-A','5-Z','0-A','12-c','abc',''], null, null);
--
--    -> created_codes        = {1-B}
--       rejected_out_of_grid = {5-Z, 27-A}    (kolom Z > I, baris 27 > 26)
--       rejected_malformed   = {0-A, 12-c, abc}
--       rejected_occupied    = {}
--       blank_count          = 1              ('' dihitung, tidak didaftar)
--
--       Panggilan HARUS BERHASIL. Kalau ia melempar 'Baris ... di luar ukuran
--       kebun' atau 'Kolom ... di luar ukuran kebun', penyaring 3c bocor dan
--       trigger yang menangkapnya -- STOP, dan JANGAN longgarkan triggernya.
--
-- 7. DUPLIKAT TIDAK MEMECAHKAN TRANSAKSI. Paling mudah terlewat:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['7-C','7-C','7-D'], null, null);
--
--    -> created_codes = {7-C, 7-D}, duplicate_codes = {7-C}, tanpa exception.
--       Kalau ia melempar 'duplicate key value violates unique constraint
--       "trees_unique_code_per_farm"', deduplikasi di 3a tidak jalan -- STOP.
--
-- 8. POSISI TERISI DISARING, HIMPUNAN SISANYA TETAP JADI. Ulangi panggilan
--    langkah 4 apa adanya:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['1-A','2-A','4-A'], null, null);
--
--    -> created_codes = {4-A}, rejected_occupied = {1-A, 2-A}, tanpa exception.
--
-- 9. POSISI BERARSIP TETAP MENEMPATI KODENYA. Arsipkan pohon '3-A', lalu:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['3-A'], null, null);
--
--    -> rejected_occupied = {3-A}, created_codes = {}, tanpa exception. Kalau
--       ia mencoba membuatnya, penyaring keterisian ikut menyaring is_archived
--       -- salah, dan ia akan menabrak constraint.
--
-- 10. NOL SAH -> LAPORAN, BUKAN GALAT:
--
--      select * from public.create_trees_at_positions(
--        '<farm>', array['999-Z','888-Y'], null, null);
--    -> created_tree_ids = {}, created_codes = {}, rejected_out_of_grid memuat
--       keduanya, dan panggilan BERHASIL. Kalau ia melempar, ia mengikuti 057 --
--       yang di sini sengaja TIDAK diikuti. Lihat kepala bagian 1.
--
--      select * from public.create_trees_at_positions('<farm>', array[]::text[], null, null);
--    -> seluruh array kosong, blank_count 0, tanpa exception.
--
--      select * from public.create_trees_at_positions('<farm>', null, null, null);
--    -> sama, tanpa exception.
--
-- 11. PEKERJA DITOLAK. Sebagai pekerja aktif kebun itu:
--
--      select * from public.create_trees_at_positions('<farm>', array['9-A'], null, null);
--
--    -> HARUS DITOLAK: 'Hanya pemilik aktif yang dapat menambah pohon.'
--       Pesannya harus SAMA PERSIS dengan create_tree_with_planting.
--
-- 12. VARIETAS DAN TANGGAL BOLEH KOSONG, DAN SPASI TERSIMPAN SEBAGAI NULL:
--
--      select * from public.create_trees_at_positions('<farm>', array['10-A'], null, null);
--      select * from public.create_trees_at_positions('<farm>', array['10-B'], '   ', null);
--
--      select tr.tree_code, tp.variety, tp.planted_at
--      from public.trees tr join public.tree_plantings tp on tp.tree_id = tr.id
--      where tr.farm_id='<farm>' and tr.tree_code in ('10-A','10-B')
--      order by tr.tree_code;
--
--    -> KEDUANYA variety NULL (bukan '' dan bukan '   '), planted_at NULL.
-- ===========================================================================
