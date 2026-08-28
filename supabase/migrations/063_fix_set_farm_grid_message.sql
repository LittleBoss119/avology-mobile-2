-- 063_fix_set_farm_grid_message.sql
--
-- Membuang saran "arsipkan" dari pesan penolakan pengecilan set_farm_grid.
--
-- MASALAHNYA: pesan di 054:377-379 menyuruh pemilik "Pindahkan atau arsipkan
-- pohon itu lebih dulu". Separuh saran itu tidak pernah berhasil.
--
-- Kueri penghalangnya (054:365-372, disalin apa adanya ke bawah) menghitung
-- SELURUH baris trees kebun itu yang jatuh di luar ukuran baru, TANPA menyaring
-- is_archived. Mengarsipkan sebuah pohon tidak mengurangi blocking_count satu
-- pun, jadi pemilik yang menuruti sarannya akan mengarsipkan pohonnya -- sebuah
-- tindakan yang mengubah data -- lalu mencoba lagi dan ditolak dengan pesan
-- yang persis sama, tanpa petunjuk kenapa.
--
-- KUERINYA YANG BENAR, PESANNYA YANG SALAH. JANGAN DIBALIK.
--
-- Ini bukan kelalaian penyaring: ia sejalan dengan invarian yang sudah terkunci
-- di proyek ini -- mengarsipkan TIDAK PERNAH membebaskan posisi. Kode posisi
-- tetap dipegang baris berarsip karena trees_unique_code_per_farm bukan
-- constraint partial (054:248), dan create_trees_at_positions sengaja tetap
-- melaporkan posisi berarsip sebagai rejected_occupied (062:96, 062:366),
-- diuji di scripts/db-tests/18-bulk-tree-creation.test.mjs:367-373. Sebuah
-- pohon berarsip yang berada di luar petak baru tetaplah pohon yang akan
-- hilang dari peta denah begitu petaknya dikecilkan. Ia MEMANG harus menahan
-- pengecilannya.
--
-- Kalau suatu saat kamu tergoda mengembalikan kata "arsipkan" ke pesan ini:
-- yang harus kamu ubah bukan pesannya, melainkan kuerinya -- dan mengubah
-- kueri itu berarti membiarkan pohon berarsip lenyap dari peta tanpa
-- peringatan. Jangan.
--
-- Tinggal "Pindahkan", dan itu memang jalan yang sungguh menolong: posisi
-- sebuah pohon bisa dikoreksi lewat update_tree_with_planting (056).
--
-- Tambahan konteks non-teknis: UI arsip pohon sedang dicabut dari aplikasi,
-- sehingga pesan lama juga akan menunjuk fitur yang tidak punya jalan masuk
-- lagi. Itu memperkuat perubahan ini, bukan yang menyebabkannya -- sarannya
-- sudah salah sejak 054 diterapkan, jauh sebelum pencabutan itu direncanakan.
--
-- PRASYARAT: 054 sudah dijalankan dan terverifikasi.
--
-- SIGNATURE TIDAK BERUBAH, jadi `create or replace` dan TIDAK ADA DROP
-- FUNCTION. Drop akan ikut membuang grant execute untuk `authenticated`
-- (pelajaran 043:220), dan tanpa itu pemilik kena "permission denied" saat
-- mengubah ukuran kebun. revoke/grant dari 054:388-392 tetap ditulis ulang di
-- bawah supaya berkas ini berdiri sendiri saat dibaca -- bukan karena drop.
--
-- BADAN FUNGSINYA DISALIN PERSIS dari 054:325-386. Satu-satunya baris yang
-- berbeda adalah literal pesan di dalam `raise exception` penjagaan pengecilan.
-- Dua placeholder tetap dua, urutannya tetap (jumlah, lalu contoh kode), dan
-- daftar argumen raise tidak bertambah maupun berkurang.
--
-- CATATAN BACA: komentar di dalam badan fungsi menyebut "bagian 2" dan
-- "bagian 4". Rujukan itu ikut tersalin apa adanya dan menunjuk bagian-bagian
-- di dalam 054, BUKAN di dalam berkas ini.
--
-- Yang SENGAJA TIDAK disentuh:
--   * Kueri penghalang -- lihat alasan panjang di atas.
--   * Keempat penjagaan lain (auth, kepemilikan, batas baris, batas kolom),
--     termasuk 'Authentication required' yang berbahasa Inggris. Aturan proyek
--     menghendaki pesan yang dilihat pengguna berbahasa Indonesia, dan pesan
--     itu melanggarnya -- tapi ia BUKAN lingkup migrasi ini dan dibiarkan utuh
--     supaya perubahan ini tetap satu hal yang bisa diverifikasi sendirian.
--   * Tabel, kolom, constraint, indeks, policy, trigger. Nol perubahan skema.
--   * farms_grid_rows_check dan farms_grid_columns_check (054:169-177), yang
--     tetap menjadi lapisan kedua di bawah penjagaan RPC ini.
-- ===========================================================================

begin;

-- ===========================================================================
-- 1. set_farm_grid -- definisi ulang dengan pesan yang diperbaiki
-- ===========================================================================

create or replace function public.set_farm_grid(
  p_farm_id uuid,
  p_rows smallint,
  p_columns smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  blocking_count integer;
  sample_code text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Hanya pemilik aktif yang dapat mengubah ukuran kebun.';
  end if;

  if p_rows is null or p_rows < 1 or p_rows > 999 then
    raise exception 'Jumlah baris harus antara 1 dan 999.';
  end if;

  -- Batas 26 dipaksa notasi kolom satu huruf, lihat bagian 2.
  if p_columns is null or p_columns < 1 or p_columns > 26 then
    raise exception 'Jumlah kolom harus antara 1 dan 26.';
  end if;

  -- PENJAGAAN PENGECILAN.
  --
  -- Tanpa ini, mengecilkan kebun akan meninggalkan pohon di luar rentang: ia
  -- tetap ada di tabel, tetap terhitung di statistik, tetapi tidak punya sel
  -- di peta denah -- hilang dari pandangan tanpa satu pun peringatan. Trigger
  -- bagian 4 tidak menolongnya karena ia hanya berbunyi saat baris trees
  -- ditulis, bukan saat ukuran kebunnya berubah di bawahnya.
  select count(*), min(tree_code)
  into blocking_count, sample_code
  from public.trees
  where farm_id = p_farm_id
    and (
      row_position > p_rows
      or (ascii(column_position) - 64) > p_columns
    );

  if blocking_count > 0 then
    raise exception
      'Ukuran kebun tidak bisa dikecilkan. Ada % pohon di luar ukuran baru, contohnya %. Pindahkan pohon itu lebih dulu.',
      blocking_count, sample_code;
  end if;

  -- updated_at sengaja tidak disebut: trigger set_farms_updated_at
  -- (006:428-432) sudah mengisinya pada setiap UPDATE ke farms.
  update public.farms
  set grid_rows = p_rows,
      grid_columns = p_columns
  where id = p_farm_id;
end;
$$;

-- Ditulis ulang VERBATIM dari 054:388-392. Tidak ada DROP FUNCTION di migrasi
-- ini, sehingga grant lama sebenarnya tetap menempel; keduanya diulang semata
-- supaya berkas ini bisa dibaca tanpa membuka 054. Keduanya idempoten.
revoke execute on function public.set_farm_grid(uuid, smallint, smallint)
  from public, anon;

grant execute on function public.set_farm_grid(uuid, smallint, smallint)
  to authenticated;

-- ===========================================================================
-- 2. Muat ulang cache schema PostgREST
--
-- Signature tidak berubah, tetapi definisi fungsinya berubah. Reload murah dan
-- konsisten dengan seluruh migrasi sebelumnya yang menyentuh fungsi ini.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH db push
--
-- 1. Fungsinya masih TUNGGAL dan signature-nya tidak berubah:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname = 'set_farm_grid';
--
--    -> harus TEPAT SATU baris: set_farm_grid(uuid, smallint, smallint)
--       Dua baris berarti ada overload yang lahir tanpa sengaja. STOP.
--
-- 2. Grant execute untuk `authenticated` masih menempel:
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'set_farm_grid';
--
--    -> `authenticated` wajib muncul. Kalau hilang, pemilik kena "permission
--       denied" saat mengubah ukuran kebun:
--       grant execute on function
--         public.set_farm_grid(uuid, smallint, smallint) to authenticated;
--
-- 3. Kata "arsipkan" sudah tidak ada lagi di badan fungsinya:
--
--      select position('arsipkan' in prosrc) as sisa
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'set_farm_grid';
--
--    -> harus 0.
--
-- 4. Kueri penghalangnya TIDAK ikut berubah -- ia tidak boleh menyaring arsip:
--
--      select position('is_archived' in prosrc) as bocor
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'set_farm_grid';
--
--    -> harus 0. Kalau bukan nol, penyaring arsip masuk ke kueri penghalang --
--       itu kebalikan dari maksud migrasi ini. STOP, lihat kepala berkas.
--
-- 5. ALUR NYATA -- pesannya berubah, perilakunya tidak.
--    a. Di kebun uji, pastikan ada pohon di baris tinggi (mis. tree_code
--       '12-A'), lalu sebagai pemilik aktif:
--
--         select public.set_farm_grid('<farm uuid>', 5::smallint, 9::smallint);
--
--       -> HARUS gagal, dan pesannya harus berbunyi:
--          "Ukuran kebun tidak bisa dikecilkan. Ada 1 pohon di luar ukuran
--           baru, contohnya 12-A. Pindahkan pohon itu lebih dulu."
--          Tanpa kata "arsipkan".
--
--    b. Arsipkan pohon itu (update trees set is_archived = true), lalu ULANGI
--       panggilan yang sama.
--
--       -> HARUS tetap gagal dengan pesan yang sama. Ini yang membuktikan
--          pesan lamanya memang salah. Kalau kali ini BERHASIL, kueri
--          penghalangnya ikut berubah dan migrasi ini salah dijalankan. STOP.
--
--    c. Pindahkan pohon itu ke dalam petak baru lewat layar edit pohon
--       (update_tree_with_planting), lalu ulangi panggilan yang sama.
--
--       -> HARUS berhasil, dan farms.grid_rows menjadi 5.
--
--    d. Pembesaran tidak pernah tersentuh penjagaan ini:
--
--         select public.set_farm_grid('<farm uuid>', 26::smallint, 9::smallint);
--
--       -> berhasil, tanpa syarat apa pun.
--
-- 6. Keempat penjagaan lain masih berbunyi apa adanya -- panggil dengan
--    p_rows = 0, p_rows = 1000, p_columns = 0, p_columns = 27, dan sekali lagi
--    sebagai NON-pemilik. Keempatnya harus menolak dengan pesan yang sama
--    seperti sebelum migrasi ini.
-- ===========================================================================
