-- 056_tree_planting_correction.sql
--
-- Koreksi data penanaman, dan penutupan jalur tulis langsung ke trees.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Migrasi 055 menutup dua lubang dan sengaja meninggalkan dua lainnya. Migrasi
-- ini menutup keduanya.
--
-- LUBANG 1 -- data penanaman tidak bisa dikoreksi.
--
-- 055 mencabut variety dan planted_at dari form edit pohon karena keduanya
-- bukan lagi milik posisi. Akibatnya salah ketik saat input berarti data itu
-- salah SELAMANYA: satu-satunya jalur keluar yang tersedia adalah
-- end_tree_planting lalu start_tree_planting -- dan itu mengarang peristiwa
-- penanaman ulang yang tidak pernah terjadi. cycle_no naik, siklus lama
-- tercatat berakhir dengan alasan yang dikarang, dan riwayat kebun memuat
-- kejadian palsu. Itu lebih merusak daripada salah ketiknya.
--
-- Dua hal yang harus dibedakan:
--
--   KOREKSI          datanya salah ketik sejak awal
--                    -> perbaiki siklus yang SEDANG AKTIF, cycle_no tetap
--
--   PENANAMAN ULANG  pohonnya sungguh diganti
--                    -> siklus BARU, cycle_no naik (start_tree_planting, 055)
--
-- 055 hanya menyediakan yang kedua. Bagian 1 di bawah menyediakan yang pertama.
--
-- LUBANG 2 -- jalur tulis langsung ke trees masih terbuka.
--
-- create_tree_with_planting menjamin "pohon selalu punya siklus" HANYA untuk
-- pohon yang dibuat lewatnya. Grant INSERT pada public.trees masih menempel di
-- authenticated (007:350) berikut policy "Active owner can insert trees"
-- (007:148-153), jadi owner aktif secara teknis MASIH BISA menyisipkan baris
-- trees telanjang lewat PostgREST. Baris itu akan berumur tanpa siklus: tidak
-- terlihat sebagai pohon (tidak punya varietas maupun tanggal tanam), tidak
-- terlihat sebagai posisi kosong (barisnya ada di trees). Bagian 2 menutupnya.
--
-- Ini persis catatan lingkup yang ditinggalkan 055:186-196.
--
-- ---------------------------------------------------------------------------
-- PRASYARAT
--
--   * 055 sudah dijalankan dan terverifikasi. Khususnya partial unique index
--     tree_plantings_one_active_per_tree -- update_tree_with_planting di bawah
--     bersandar padanya sama seperti ketiga RPC 055: ia menganggap "siklus
--     aktif" bermakna TUNGGAL. Kalau index itu tidak terpasang, JANGAN pakai.
--
-- VERIFIKASI SEBELUM MENCABUT GRANT (sudah dijalankan saat migrasi ini
-- disusun): penelusuran seluruh src/, app/, dan scripts/ untuk pola
-- `.from('trees').insert` mengembalikan NOL kemunculan. Satu-satunya kecocokan
-- teks adalah pesan assertion di
-- scripts/db-tests/15-tree-planting-cycle.test.mjs:61 ('create_tree_with_planting
-- should insert into trees.'), bukan panggilan. Seluruh akses lain ke tabel
-- trees adalah SELECT atau UPDATE.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * Grant UPDATE pada public.trees, dan policy "Active owner can update
--     trees". Jalur pengarsipan pohon masih memakainya, dan pengarsipan di luar
--     lingkup migrasi ini. Lihat CATATAN LINGKUP di bagian 2.
--   * is_archived dan seluruh jalur pengarsipan.
--   * Kondisi pohon. Koreksi penanaman TIDAK menyentuh current_condition, sama
--     seperti end_tree_planting tidak menyentuhnya (055).
--   * Siklus yang SUDAH DITUTUP. Lihat alasannya di bagian 1.
--   * tree_history_view.
--   * Penjadwalan multi-pohon dan penyaringan pohon tanpa siklus aktif --
--     migrasi 057.

begin;

-- ===========================================================================
-- 1. update_tree_with_planting -- KOREKSI posisi + data siklus aktif
--
-- Satu RPC, bukan dua panggilan terpisah. Kalau posisi diperbarui lewat UPDATE
-- ke trees dan varietas lewat jalur lain, edit yang mengubah KEDUANYA bisa
-- berhasil separuh -- posisi tersimpan, varietas gagal -- dan tidak ada cara
-- membatalkannya dari sisi klien. Klien Supabase tidak bisa membungkus dua
-- statement dalam satu transaksi; hanya fungsi di sisi database yang bisa.
-- Alasan yang sama persis dengan create_tree_with_planting (055:4a).
--
-- MENOLAK KALAU TIDAK ADA SIKLUS AKTIF. Dua alasannya:
--
--   * Posisi kosong -- mengoreksi "data penanaman" pada posisi yang tidak
--     ditanami apa pun tidak punya makna. Tidak ada penanaman untuk dikoreksi.
--   * Siklus sudah ditutup -- itu fakta yang sudah selesai. Menyentuhnya berarti
--     mengubah riwayat pohon yang sudah tidak ada, dan tidak ada satu pun jalur
--     baca yang akan menunjukkan bahwa perubahan itu terjadi.
--
-- Rentang posisi terhadap ukuran kebun TIDAK diperiksa di sini: itu milik
-- validate_tree_position_trigger (054:306-311), yang berbunyi pada UPDATE ke
-- trees di bawah -- triggernya `before insert or update`, bukan insert saja.
-- Mengulangnya berarti dua tempat yang harus dijaga sinkron.
--
-- Yang TETAP diperiksa: posisi tidak boleh NULL. Itu bukan pengulangan validasi
-- rentang -- tanpa penjaga ini pemanggil membaca 'null value in column
-- "row_position" violates not-null constraint', balasan Postgres, bukan pesan
-- yang bisa dimengerti owner.
-- ===========================================================================

create or replace function public.update_tree_with_planting(
  p_tree_id uuid,
  p_row_position smallint,
  p_column_position text,
  p_variety text default null,
  p_planted_at date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  tree_farm_id uuid;
  active_planting_id uuid;
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
    raise exception 'Hanya pemilik aktif yang dapat memperbarui data pohon.';
  end if;

  if p_row_position is null or p_column_position is null then
    raise exception 'Baris dan kolom wajib diisi.';
  end if;

  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  select id
  into active_planting_id
  from public.tree_plantings
  where tree_id = p_tree_id
    and ended_at is null;

  -- Penjaga ini SENGAJA berada SEBELUM kedua UPDATE. Kalau ia dipasang
  -- sesudahnya, koreksi pada posisi tanpa siklus aktif tetap sempat memindahkan
  -- posisi pohonnya sebelum ditolak.
  if active_planting_id is null then
    raise exception
      'Posisi ini tidak punya pohon aktif. Koreksi data penanaman hanya berlaku untuk siklus tanam yang sedang berjalan.';
  end if;

  -- Kedua UPDATE dalam satu transaksi fungsi: keduanya jadi, atau tidak sama
  -- sekali. Ini yang membedakannya dari dua panggilan terpisah dari klien.
  update public.trees
  set row_position = p_row_position,
      column_position = p_column_position
  where id = p_tree_id;

  -- KOREKSI, bukan penanaman ulang: cycle_no TIDAK disentuh, ended_at tetap
  -- NULL, dan tidak ada baris baru yang lahir.
  --
  -- nullif(btrim(...), '') sepadan dengan create_tree_with_planting dan
  -- start_tree_planting: varietas kosong tersimpan sebagai NULL, bukan ''.
  update public.tree_plantings
  set variety = nullif(btrim(p_variety), ''),
      planted_at = p_planted_at
  where id = active_planting_id;
end;
$$;

revoke execute on function public.update_tree_with_planting(uuid, smallint, text, text, date)
  from public, anon;

grant execute on function public.update_tree_with_planting(uuid, smallint, text, text, date)
  to authenticated;

-- ===========================================================================
-- 2. Kunci jalur tulis langsung ke trees
--
-- Setelah dua statement di bawah, create_tree_with_planting adalah SATU-SATUNYA
-- cara sebuah baris trees bisa lahir. Fungsi itu SECURITY DEFINER, jadi ia
-- berjalan sebagai pemilik tabel dan tidak terpengaruh pencabutan ini -- itu
-- memang maksudnya. Pembuatan pohon hanya bisa lewat jalur yang menjamin
-- siklus tanamnya ikut terbentuk dalam transaksi yang sama.
--
-- Polanya sepadan dengan tree_plantings setelah 055:3 dan care_activities
-- setelah 043:388-389.
--
-- CATATAN LINGKUP -- UPDATE SENGAJA TIDAK DICABUT.
--
-- Grant UPDATE dan policy "Active owner can update trees" (007:156-161) tetap
-- utuh. archiveTree/restoreTree di src/services/treeService.ts masih menulis
-- is_archived lewat PostgREST langsung, dan memindahkannya ke RPC berarti
-- menyentuh jalur pengarsipan -- di luar lingkup migrasi ini. Celah yang
-- tersisa jauh lebih kecil daripada INSERT: UPDATE tidak bisa MELAHIRKAN baris
-- trees tanpa siklus, ia hanya bisa mengubah baris yang sudah ada dan sudah
-- lolos create_tree_with_planting.
-- ===========================================================================

drop policy if exists "Active owner can insert trees" on public.trees;

-- anon tidak pernah diberi grant apa pun pada trees (007:350 hanya menyebut
-- authenticated), jadi ia sengaja tidak disebut di sini: mencabut yang tidak
-- pernah ada hanya mengaburkan maksud statement ini.
revoke insert on public.trees from authenticated;

-- ===========================================================================
-- 3. Muat ulang cache schema PostgREST
--
-- Satu RPC baru yang dipanggil klien, dan satu grant tabel yang berubah.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. RPC ada, TEPAT SATU signature:
--
--      select p.oid::regprocedure, p.prosecdef
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='update_tree_with_planting';
--
--    -> satu baris, prosecdef = true (SECURITY DEFINER). Kalau ada DUA baris,
--       ada overload yang tertinggal dan PostgREST akan bingung memilih.
--
-- 2. PENJAGAAN TERPENTING MIGRASI INI. Grant INSERT benar-benar dicabut --
--    authenticated hanya boleh SELECT dan UPDATE pada trees:
--
--      select privilege_type from information_schema.role_table_grants
--       where table_schema='public' and table_name='trees'
--         and grantee='authenticated'
--       order by 1;
--
--    -> harus TEPAT 'SELECT' dan 'UPDATE'. Kalau 'INSERT' masih muncul,
--       lubang 2 MASIH TERBUKA dan jaminan "pohon selalu punya siklus" belum
--       berlaku. Kalau 'UPDATE' HILANG, jalur pengarsipan pohon patah -- itu
--       bukan yang diminta migrasi ini, perbaiki sebelum lanjut.
--
-- 3. Policy insert benar-benar hilang, policy lain utuh:
--
--      select policyname, cmd from pg_policies
--       where schemaname='public' and tablename='trees'
--       order by policyname;
--
--    -> hanya "Active members can view trees" (SELECT) dan "Active owner can
--       update trees" (UPDATE). Tidak boleh ada baris ber-cmd INSERT.
--
-- 4. Pembuatan pohon lewat RPC TETAP JALAN meski grant dicabut. Ini yang
--    membuktikan SECURITY DEFINER benar-benar melewatinya. Sebagai owner aktif:
--
--      select public.create_tree_with_planting(
--        '<farm>', 5::smallint, 'E', 'Alpukat Mentega', current_date);
--
--    -> mengembalikan tree_id. Kalau ini gagal dengan 'permission denied for
--       table trees', fungsinya TIDAK dimiliki pemilik tabel -- STOP, jalur
--       pembuatan pohon patah total.
--
-- 5. INSERT langsung DITOLAK. Sebagai owner aktif, lewat PostgREST atau
--    sebagai role authenticated:
--
--      insert into public.trees (farm_id, row_position, column_position)
--      values ('<farm>', 6::smallint, 'F');
--
--    -> HARUS DITOLAK: 'permission denied for table trees'.
--
-- 6. Alur koreksi, berurutan sebagai owner aktif pada pohon dari langkah 4:
--
--    a. select cycle_no, variety, planted_at from public.tree_plantings
--        where tree_id='<tree>' and ended_at is null;
--       -> catat cycle_no-nya.
--
--    b. select public.update_tree_with_planting(
--         '<tree>', 5::smallint, 'E', 'Miki', '2024-03-01');
--       -> sukses. Lalu periksa:
--
--          select cycle_no, variety, planted_at, ended_at
--            from public.tree_plantings where tree_id='<tree>';
--          -> TETAP SATU BARIS. variety 'Miki', planted_at '2024-03-01',
--             ended_at NULL, dan cycle_no SAMA PERSIS dengan langkah 6a.
--             Kalau muncul baris kedua atau cycle_no naik, ini bukan koreksi
--             melainkan penanaman ulang -- SALAH.
--
--    c. select public.update_tree_with_planting(
--         '<tree>', 4::smallint, 'D', 'Miki', '2024-03-01');
--       -> sukses, dan tree_code ikut berubah:
--
--          select tree_code from public.trees where id='<tree>';
--          -> '4-D'. tree_code GENERATED dari kedua kolom (054).
--
--    d. select public.update_tree_with_planting(
--         '<tree>', 999::smallint, 'D', 'Miki', '2024-03-01');
--       -> HARUS DITOLAK oleh validate_tree_position_trigger kalau kebunnya
--          lebih kecil dari 999 baris. Ini yang membuktikan trigger 054 ikut
--          berbunyi pada UPDATE, bukan hanya INSERT.
--
--    e. select public.end_tree_planting('<tree>', 'mati', current_date);
--       lalu select public.update_tree_with_planting(
--         '<tree>', 4::smallint, 'D', 'Hass', '2024-03-01');
--       -> HARUS DITOLAK: 'Posisi ini tidak punya pohon aktif...'
--
--    f. Setelah penolakan di 6e, posisinya TIDAK ikut berubah:
--
--          select tree_code from public.trees where id='<tree>';
--          -> tetap '4-D'.
--
-- 7. Pekerja aktif tidak bisa mengoreksi. Sebagai pekerja:
--
--      select public.update_tree_with_planting(
--        '<tree>', 1::smallint, 'A', 'Miki', current_date);
--
--    -> HARUS DITOLAK: 'Hanya pemilik aktif yang dapat memperbarui data pohon.'
--
-- 8. Koreksi TIDAK menyentuh kondisi pohon:
--
--      select current_condition from public.trees where id='<tree>';
--
--    -> tetap seperti sebelum update_tree_with_planting dipanggil.
-- ===========================================================================
