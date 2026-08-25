-- 054_farm_grid_and_tree_position.sql
--
-- Kebun punya ukuran, dan posisi pohon tidak bisa lagi diketik sembarangan.
--
-- ---------------------------------------------------------------------------
-- KOREKSI LEDGER ATAS MIGRASI 053 -- BACA INI DULU
--
-- Migrasi 053 memuat komentar yang KELIRU. Di bagian G ia menulis bahwa
-- reopen_operational_report "TIDAK ADA di database live walau dibuat migrasi
-- 020 dan tidak pernah di-drop -- drift lama".
--
-- Itu SALAH, dan kekeliruannya ada di dua tempat: fungsi itu dibuang secara
-- SENGAJA oleh migrasi 031, baris 123:
--
--     drop function if exists reopen_operational_report(uuid, text);
--
-- Jadi ketiadaannya bukan drift, melainkan perilaku yang dirancang. Migrasi 031
-- memang membuangnya sebagai bagian dari "hapus reopen laporan (B5)" (031:4).
--
-- KENAPA SAMPAI TERLEWAT: inventaris fungsi yang dipakai saat menyusun 053
-- mencari pola `drop function if exists public.` -- mensyaratkan prefix skema.
-- Migrasi 031 adalah SATU-SATUNYA berkas yang menulis tanpa prefix, sehingga
-- KEEMPAT BELAS `drop function`-nya (031:111-128) tidak masuk inventaris. Yang
-- ikut terlewat dan baru ketahuan belakangan lewat kegagalan berkas uji:
-- soft_delete_own_tree_condition_report, soft_delete_own_growth_phase_record,
-- soft_delete_own_harvest_record, soft_delete_own_manual_care_record,
-- update_own_manual_care_record, dan enam helper foto can_*.
--
-- DAMPAK PADA 053: nihil secara fungsional. Baris
-- `drop function if exists public.reopen_operational_report(uuid);` di sana
-- adalah no-op -- fungsinya sudah lama tidak ada, dan `if exists` menanganinya.
-- (Signature aslinya `(uuid, text)`, bukan `(uuid)`; dengan `if exists`
-- keduanya sama-sama tidak melakukan apa pun.)
--
-- Berkas 053 SUDAH diterapkan ke database dan karena itu TIDAK DIEDIT. Koreksi
-- ini ditulis di sini supaya ledger tetap jujur. Pembaca 053 yang sampai ke
-- komentar itu harus membaca paragraf ini sebagai pembetulannya.
--
-- Pelajaran operasionalnya: saat menginventarisasi objek lewat grep, jangan
-- mensyaratkan prefix skema. Penulisan `public.` tidak konsisten antar berkas.
--
-- ---------------------------------------------------------------------------
-- KENAPA MIGRASI INI ADA
--
-- tree_code selama ini diketik TERPISAH dari posisinya, dan row_position /
-- column_position bertipe text bebas tanpa satu pun constraint. Akibatnya data
-- uji memuat 'A-A', 'Z-01' berdampingan dengan 'Z-1', dan 'A-1000' -- semuanya
-- lolos tanpa keberatan, karena memang tidak ada yang memeriksanya.
--
-- Migrasi ini membuat kelas kesalahan itu MUSTAHIL SECARA STRUKTURAL, bukan
-- sekadar ditolak validasi aplikasi:
--
--   * row_position jadi smallint -- huruf tidak bisa masuk sama sekali.
--   * column_position jadi text ber-CHECK '^[A-Z]$' -- tepat satu huruf kapital.
--   * tree_code jadi kolom GENERATED -- tidak bisa ditulis, tidak bisa
--     menyimpang dari posisinya, selamanya.
--   * rentangnya diperiksa trigger terhadap ukuran kebun.
--
-- KONVENSI: baris = ANGKA, kolom = HURUF, menghasilkan '1-A'. Kode lama
-- kebalikannya (buildTreeDisplayCode menyusun {row}-{column} dengan row
-- di-uppercase, dan form-nya memberi contoh Baris "A" / Kolom "1"). Sisi
-- aplikasi dibalik pada commit yang sama.
--
-- ---------------------------------------------------------------------------
-- PRASYARAT
--
--   * 053 sudah dijalankan dan terverifikasi; operational_reports tidak ada.
--   * Seluruh data pohon adalah data uji dan boleh dibuang total. Kebun,
--     keanggotaan, profil, dan riwayat akses TIDAK dibuang.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * is_archived -- tetap apa adanya, bukan lingkup migrasi ini.
--   * create_farm_with_owner dan update_farm_profile -- signature keduanya
--     dipakai klien. Dimensi kebun diatur RPC BARU set_farm_grid, bukan dengan
--     mengubah signature yang sudah ada.
--   * Tabel siklus tanam, penjadwalan multi-pohon, tipe entitas foto baru, dan
--     UI peta denah -- semuanya migrasi berikutnya.

begin;

-- ===========================================================================
-- 1. (1.1) Buang data uji
--
-- URUTANNYA WAJIB. Setiap langkah menghindari satu pelanggaran constraint yang
-- konkret, bukan sekadar kerapian.
-- ===========================================================================

-- 1a -- seluruh baris foto.
--
-- Sekaligus membuang 15 baris 'task_proof' yatim yang tertinggal dari
-- cleanup_orphan_recurring_schedule (041:217): trigger itu menghapus care_tasks
-- dan care_activities penerus rantai, tetapi photo_attachments.entity_id BUKAN
-- foreign key (013:31) sehingga tidak ada CASCADE yang menyusul.
delete from public.photo_attachments;

-- 1b -- hasil kerja. care_activity_trees ikut lewat CASCADE (025:54-55).
delete from public.care_activities;

-- 1c -- tugas, WAJIB sebelum care_schedules.
--
-- care_tasks.care_schedule_id memakai `on delete set null` (004:109). Kalau
-- jadwalnya dihapus lebih dulu, kolom itu jadi NULL dan melanggar
-- care_tasks_source_check (`check (care_schedule_id is not null)`, dipasang
-- migrasi 053).
delete from public.care_tasks;

-- 1d -- jadwal, WAJIB sebelum trees.
--
-- care_schedules.target_tree_id memakai `on delete set null` (004:58). Kalau
-- pohonnya dihapus lebih dulu, jadwal bertarget 'tree' kehilangan targetnya dan
-- melanggar care_schedules_target_check (047:75-77), yang mewajibkan
-- target_tree_id terisi untuk target_type = 'tree'.
delete from public.care_schedules;

-- 1e -- catatan per pohon. Ketiganya CASCADE dari trees, tapi dihapus eksplisit
-- supaya urutannya terbaca dan tidak bergantung pada perilaku CASCADE.
delete from public.tree_condition_reports;
delete from public.growth_phase_records;
delete from public.harvest_records;

-- 1f -- pohon.
--
-- prevent_tree_delete_trigger (006:416-420) melempar exception pada SETIAP
-- DELETE ke trees -- itu penjaga yang benar untuk pemakaian normal, dan justru
-- karena itu ia harus dilumpuhkan sesaat di sini, bukan dibuang.
--
-- Dinonaktifkan dan dipasang kembali DI DALAM transaksi yang sama: kalau
-- migrasi ini gagal di tengah, rollback mengembalikan trigger ke keadaan aktif
-- bersama seluruh perubahan lain. Tidak ada jendela waktu di mana trigger itu
-- mati di database yang sudah di-commit.
alter table public.trees disable trigger prevent_tree_delete_trigger;

delete from public.trees;

alter table public.trees enable trigger prevent_tree_delete_trigger;

-- ===========================================================================
-- 2. (1.2) Dimensi kebun
--
-- Default 26 x 9 berasal dari MS Farm: 26 baris, 9 kolom (A-I).
--
-- Batas 26 pada grid_columns bukan angka sembarangan -- kolom dilambangkan
-- TEPAT SATU huruf A-Z (lihat CHECK column_position di bagian 3), jadi 26
-- adalah batas keras yang dipaksa notasinya, bukan preferensi.
-- ===========================================================================

-- Ditambahkan dulu sebagai nullable, diisi, baru dikunci NOT NULL. Kebun yang
-- sudah ada tidak dibuang di migrasi ini, jadi baris lamanya harus terisi.
alter table public.farms
  add column if not exists grid_rows smallint,
  add column if not exists grid_columns smallint;

update public.farms
set grid_rows = coalesce(grid_rows, 26),
    grid_columns = coalesce(grid_columns, 9);

alter table public.farms
  alter column grid_rows set default 26,
  alter column grid_columns set default 9,
  alter column grid_rows set not null,
  alter column grid_columns set not null;

alter table public.farms
  drop constraint if exists farms_grid_rows_check;

alter table public.farms
  add constraint farms_grid_rows_check
  check (grid_rows between 1 and 999);

alter table public.farms
  drop constraint if exists farms_grid_columns_check;

alter table public.farms
  add constraint farms_grid_columns_check
  check (grid_columns between 1 and 26);

comment on column public.farms.grid_rows is
  'Jumlah baris kebun. Baris dilambangkan angka, mulai dari 1.';

comment on column public.farms.grid_columns is
  'Jumlah kolom kebun. Kolom dilambangkan satu huruf A-Z, jadi maksimum 26.';

-- ===========================================================================
-- 3. (1.3) Posisi pohon
--
-- Tabelnya kosong sejak bagian 1, jadi kolom lama DIBUANG dan yang baru
-- dipasang -- bukan `alter column ... type ... using`. Tidak ada data yang
-- perlu dikonversi, dan konversi teks-bebas ke smallint akan gagal pada nilai
-- seperti 'A' yang memang ada di data uji.
-- ===========================================================================

-- 3a -- tree_code lama.
--
-- trees_unique_code_per_farm (003:15) ikut terbuang bersama kolomnya; ia
-- dipasang ulang di 3d setelah kolom generated-nya ada.
--
-- Sengaja TANPA cascade. Penelusuran seluruh folder migrasi: tree_code hanya
-- disebut di 003:4 dan 003:15, nol view dan nol fungsi merujuknya
-- (tree_history_view tidak memilihnya). Kalau ternyata masih ada yang
-- bergantung, migrasi ini HARUS gagal keras supaya ketahuan.
alter table public.trees
  drop column tree_code;

-- 3b -- posisi lama (text bebas, tanpa constraint apa pun).
alter table public.trees
  drop column row_position,
  drop column column_position;

-- 3c -- posisi baru.
--
-- NOT NULL tanpa default aman karena tabelnya kosong.
--
-- Batas 999 pada baris sepadan dengan farms_grid_rows_check. Ini pagar salah
-- ketik di tingkat baris; batas SEBENARNYA per kebun ditegakkan trigger di
-- bagian 4, yang membaca farms.grid_rows.
alter table public.trees
  add column row_position smallint not null,
  add column column_position text not null,
  add constraint trees_row_position_check
    check (row_position between 1 and 999),
  add constraint trees_column_position_check
    check (column_position ~ '^[A-Z]$');

-- 3d -- tree_code sebagai kolom GENERATED.
--
-- Inilah inti migrasi ini: kode pohon berhenti menjadi nilai yang diketik dan
-- menjadi TURUNAN posisinya. Tidak ada jalur tulis apa pun -- klien, RPC,
-- maupun SQL langsung -- yang bisa membuatnya menyimpang.
--
-- Ekspresinya immutable: cast smallint -> text lewat konversi I/O (int2out +
-- textin, keduanya immutable) dan operator || pada text juga immutable. Beda
-- dari cast timestamp -> text, yang stable karena bergantung DateStyle dan
-- karena itu ditolak di kolom generated.
alter table public.trees
  add column tree_code text
  generated always as (row_position::text || '-' || column_position) stored;

comment on column public.trees.tree_code is
  'Kode posisi tanam, diturunkan otomatis dari row_position dan column_position sebagai {baris}-{kolom}, mis. 1-A. GENERATED -- jangan pernah dikirim di INSERT/UPDATE.';

-- 3e -- keunikan kode per kebun, dipasang ulang di atas kolom generated.
--
-- Maknanya bergeser dan pergeseran itu disengaja: dulu ia menjamin "kode tidak
-- kembar", sekarang ia menjamin "satu posisi tanam hanya ditempati satu pohon".
alter table public.trees
  add constraint trees_unique_code_per_farm unique (farm_id, tree_code);

-- ===========================================================================
-- 4. (1.4) Trigger validasi rentang
--
-- CHECK constraint tidak bisa dipakai untuk ini: batasnya hidup di baris
-- farms, dan CHECK dilarang membaca tabel lain.
--
-- Bentuknya mengikuti validate_care_task() (versi 053): plpgsql, SECURITY
-- DEFINER, search_path dipatok, membaca baris induk lalu raise exception.
-- Bedanya pesan di sini berbahasa Indonesia dan menyebut rentang yang berlaku,
-- karena yang membacanya pemilik kebun di lapangan, bukan pengembang.
--
-- Batas BAWAH tidak diperiksa di sini -- trees_row_position_check dan
-- trees_column_position_check (bagian 3c) sudah menutupnya lebih dulu.
-- ===========================================================================

create or replace function public.validate_tree_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  farm_rows smallint;
  farm_columns smallint;
  column_number integer;
begin
  select grid_rows, grid_columns
  into farm_rows, farm_columns
  from public.farms
  where id = new.farm_id;

  if farm_rows is null then
    raise exception 'Kebun untuk pohon ini tidak ditemukan.';
  end if;

  if new.row_position > farm_rows then
    raise exception
      'Baris % di luar ukuran kebun. Baris yang tersedia: 1 sampai %.',
      new.row_position, farm_rows;
  end if;

  -- 'A' berada di posisi 65 pada tabel ASCII, jadi -64 memetakannya ke 1.
  -- Aman dari NULL dan dari huruf kecil: trees_column_position_check sudah
  -- memastikan nilainya tepat satu huruf kapital sebelum baris ini jalan.
  column_number := ascii(new.column_position) - 64;

  if column_number > farm_columns then
    raise exception
      'Kolom % di luar ukuran kebun. Kolom yang tersedia: A sampai %.',
      new.column_position, chr(64 + farm_columns);
  end if;

  return new;
end;
$$;

drop trigger if exists validate_tree_position_trigger on public.trees;

create trigger validate_tree_position_trigger
before insert or update on public.trees
for each row
execute function public.validate_tree_position();

-- ===========================================================================
-- 5. (1.5) set_farm_grid -- RPC pengatur dimensi
--
-- RPC BARU, bukan perubahan signature. create_farm_with_owner dan
-- update_farm_profile sengaja tidak disentuh: keduanya dipanggil klien dengan
-- signature tetap, dan menambah parameter di sana berarti drop-and-recreate
-- yang menyeret grant serta memaksa klien lama gagal (pelajaran migrasi 024
-- soal overload, dan 043:220-228 soal grant yang ikut hilang saat drop).
--
-- Kebun baru cukup memakai default 26 x 9 dari bagian 2.
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
      'Ukuran kebun tidak bisa dikecilkan: % pohon berada di luar ukuran baru (contoh: %). Pindahkan atau arsipkan pohon itu lebih dulu.',
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

revoke execute on function public.set_farm_grid(uuid, smallint, smallint)
  from public, anon;

grant execute on function public.set_farm_grid(uuid, smallint, smallint)
  to authenticated;

-- ===========================================================================
-- 6. Muat ulang cache schema PostgREST
--
-- Kolom trees berubah bentuk, farms bertambah dua kolom, dan ada satu RPC
-- baru yang dipanggil klien. Tanpa reload, klien kena PGRST202/PGRST204.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom farms terpasang dengan sifat yang benar:
--
--      select column_name, data_type, is_nullable, column_default
--      from information_schema.columns
--      where table_schema='public' and table_name='farms'
--        and column_name in ('grid_rows','grid_columns');
--
--    -> keduanya smallint, NOT NULL, default 26 dan 9.
--
-- 2. Tidak ada kebun yang kosong dimensinya -- harus 0:
--
--      select count(*) from public.farms
--       where grid_rows is null or grid_columns is null;
--
-- 3. tree_code benar-benar GENERATED -- harus 'ALWAYS':
--
--      select column_name, is_generated, generation_expression
--      from information_schema.columns
--      where table_schema='public' and table_name='trees'
--        and column_name='tree_code';
--
-- 4. Kolom posisi lama sudah hilang -- harus 0 baris:
--
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='trees'
--         and column_name in ('row_position','column_position')
--         and data_type = 'text';
--
--    -> row_position kini smallint; kalau salah satu masih text, 3b gagal.
--
-- 5. Trigger terpasang, dan prevent_tree_delete_trigger AKTIF KEMBALI:
--
--      select tgname, tgenabled
--      from pg_trigger
--      where tgrelid = 'public.trees'::regclass and not tgisinternal
--      order by tgname;
--
--    -> validate_tree_position_trigger ada, dan tgenabled = 'O' untuk
--       prevent_tree_delete_trigger. Kalau ia 'D', trigger masih lumpuh --
--       itu bug, hentikan pemakaian dan perbaiki sebelum lanjut.
--
-- 6. Tabel-tabel yang harus kosong -- semuanya 0:
--
--      select
--        (select count(*) from public.trees)                  as trees,
--        (select count(*) from public.care_schedules)          as schedules,
--        (select count(*) from public.care_tasks)              as tasks,
--        (select count(*) from public.care_activities)         as activities,
--        (select count(*) from public.care_activity_trees)     as activity_trees,
--        (select count(*) from public.photo_attachments)       as photos,
--        (select count(*) from public.tree_condition_reports)  as conditions,
--        (select count(*) from public.growth_phase_records)    as phases,
--        (select count(*) from public.harvest_records)         as harvests;
--
-- 7. Yang TIDAK boleh ikut terbuang -- ketiganya harus > 0:
--
--      select
--        (select count(*) from public.farms)              as farms,
--        (select count(*) from public.farm_members)       as members,
--        (select count(*) from public.profiles)           as profiles;
--
-- 8. Kode pohon benar-benar terbentuk sendiri. Lewat aplikasi, tambahkan satu
--    pohon di baris 1 kolom A, lalu:
--
--      select row_position, column_position, tree_code
--      from public.trees order by created_at desc limit 1;
--
--    -> tree_code harus '1-A'. Kalau ia 'A-1', sisi aplikasi belum dibalik.
--
-- 9. Penolakan yang harus terjadi (jalankan sebagai owner aktif lewat RPC atau
--    SQL Editor, dan HARAPKAN error -- bukan sukses):
--
--    a. insert ... (row_position, column_position) values (1, 'a')
--       -> ditolak trees_column_position_check.
--    b. insert ... values (1, 'AA')
--       -> ditolak trees_column_position_check.
--    c. insert ... values (27, 'A') pada kebun default 26 baris
--       -> ditolak validate_tree_position_trigger, pesan menyebut '1 sampai 26'.
--    d. insert ... values (1, 'Z') pada kebun default 9 kolom
--       -> ditolak validate_tree_position_trigger, pesan menyebut 'A sampai I'.
--    e. insert dengan tree_code disebut eksplisit
--       -> ditolak: kolom generated tidak bisa ditulis.
--    f. select set_farm_grid('<farm>', 1::smallint, 1::smallint) saat ada pohon
--       di luar 1x1 -> ditolak, pesan menyebut jumlah pohon dan satu contoh kode.
--
-- 10. delete from public.trees where id = '<uuid>'
--     -> HARUS ditolak 'Trees must be archived or unarchived...'. Ini yang
--        membuktikan trigger di 1f benar-benar hidup lagi.
-- ===========================================================================
