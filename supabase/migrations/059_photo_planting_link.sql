-- 059_photo_planting_link.sql
--
-- Foto diikat ke siklus tanam, bukan ke posisi.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Sejak 054 tree_code adalah POSISI, dan sejak 055 satu posisi bisa ditanami
-- berkali-kali -- tiap siklus adalah pohon yang BERBEDA. Foto tidak mengetahui
-- itu sama sekali: photo_attachments hanya punya entity_id, yang untuk
-- 'tree_main' menunjuk trees.id, yaitu posisinya.
--
-- Dua cacat yang sudah terlihat di layar:
--
--   1. Posisi yang ditanami ulang menampilkan foto pohon LAMA sebagai foto
--      pohon baru, sampai pemiliknya mengunggah foto pengganti.
--   2. Riwayat foto kondisi mencampur pohon-pohon berbeda di satu posisi.
--
-- ---------------------------------------------------------------------------
-- KENAPA NULLABLE, DAN KENAPA NULL TIDAK BOLEH DISEMBUNYIKAN
--
-- Kolomnya nullable, dan itu keputusan yang menentukan bentuk seluruh migrasi:
--
--   * Selama boleh NULL, TIDAK SATU POLICY PUN perlu disentuh. Keenam policy
--     foto (053 bagian E) tetap berbasis farm_id/entity_id apa adanya. Keenamnya
--     baru saja diberi jaring tes di stage 17; membongkarnya di sini akan
--     menukar cacat tampilan dengan risiko hak akses.
--
--   * NULL berarti "siklusnya TIDAK DIKETAHUI", BUKAN "milik siklus lain".
--     Karena itu jalur baca WAJIB tetap menampilkan foto ber-NULL. Menyaringnya
--     berarti foto yang selama ini terlihat mendadak lenyap dari layar pemilik
--     -- kehilangan data yang terlihat, akibat migrasi yang justru dimaksudkan
--     memperbaiki. Foto yang salah tampil jauh lebih ringan daripada foto yang
--     hilang.
--
--   Yang disaring HANYA foto yang planting_id-nya diketahui DAN berbeda dari
--   siklus yang sedang dilihat.
--
-- ---------------------------------------------------------------------------
-- KENAPA task_proof DIKECUALIKAN
--
-- Ia tidak bisa diikat, bukan sekadar tidak perlu.
--
-- entity_id untuk 'task_proof' menunjuk care_activities.id, dan care_activities
-- TIDAK punya kolom pohon sama sekali (004:168-176). Satu-satunya jalan ke pohon
-- adalah tabel jembatan care_activity_trees (025:53-59), yang berkardinalitas
-- BANYAK-KE-BANYAK: sejak 050 satu aktivitas menyentuh N pohon untuk sasaran
-- 'farm', dan sejak 057 juga untuk sasaran 'tree' berpohon banyak.
--
-- Jadi satu foto bukti kerja bisa sah-sah saja milik selusin pohon di selusin
-- posisi sekaligus. Memberinya SATU planting_id berarti benar untuk satu pohon
-- dan salah untuk sisanya. Trigger di bawah karena itu memaksanya NULL, dan
-- backfill tidak menyentuhnya.
--
-- ---------------------------------------------------------------------------
-- ATURAN BACKFILL, DAN KENAPA IA BUKAN TEBAKAN
--
-- Satu aturan untuk backfill DAN untuk unggahan baru, sengaja identik supaya
-- keduanya tidak bisa menyimpang sendiri-sendiri:
--
--     siklus yang berlaku = baris tree_plantings pohon itu dengan created_at
--     TERBESAR yang masih <= waktu acuan foto
--
-- Waktu acuannya:
--     tree_main        -> photo_attachments.created_at   (saat foto diunggah)
--     condition_record -> tree_condition_reports.created_at (saat catatan dibuat)
--
-- Kenapa created_at, bukan planted_at/reported_at:
--
--   * tree_plantings.planted_at BOLEH NULL dan BISA DIMUNDURKAN pemiliknya lewat
--     correct_active_planting (056). Ia tanggal yang dilaporkan manusia.
--     tree_plantings.created_at not null dan tidak punya jalur tulis sama sekali
--     -- ia saat baris siklus itu benar-benar lahir.
--   * tree_condition_reports.reported_at BISA DIUBAH lewat
--     update_own_tree_condition_report (023:276), yang menyetel reported_at tapi
--     TIDAK PERNAH menyentuh created_at. Diperiksa langsung pada definisi
--     fungsinya.
--
-- Kenapa perbandingan waktu ini bukan tebakan untuk kedua entitas:
--
--   * tree_main -- tidak ada satu pun jalur di aplikasi yang bisa melekatkan
--     foto utama ke siklus LAMPAU. uploadTreeMainPhoto selalu melekat ke pohon
--     yang sedang berdiri, dan ia menghapus foto tree_main sebelumnya pada
--     posisi yang sama. Jadi "siklus yang aktif saat foto diunggah" bukan
--     perkiraan, melainkan persis apa yang terjadi.
--   * condition_record -- catatannya harus sudah ada sebelum fotonya bisa
--     diunggah (can_upload_condition_record_photo menuntut barisnya ada), dan
--     created_at catatan itu kekal.
--
-- Kasus yang TETAP dibiarkan NULL, tanpa dipaksakan:
--
--   * seluruh 'task_proof', karena alasan di atas;
--   * foto yang pohonnya tidak punya satu pun baris tree_plantings dengan
--     created_at <= waktu acuan;
--   * foto 'condition_record' yang catatannya sudah tidak ada, atau yang
--     farm_id-nya tidak cocok.
--
-- Migrasi ini TIDAK mengisi satu pun dari ketiganya dengan tebakan. Ia
-- menghitungnya dan MELAPORKAN jumlahnya lewat RAISE NOTICE di bagian 5,
-- karena jumlah sebenarnya hanya bisa dilihat saat migrasi ini benar-benar
-- dijalankan -- tidak ada cara membacanya dari luar tanpa service_role.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * Keenam policy foto. Nol perubahan, nol drop, nol create.
--   * tree_history_view dan is_archived.
--   * Satu pun baris foto yang sudah ada tidak dihapus atau diubah selain
--     kolom baru ini; nol berkas Storage disentuh.
--   * entity_type dan folder Storage: tidak ada yang ditambah.
--
-- Nomor 017 dan 042 memang tidak pernah ada -- jangan diisi.

begin;

-- ===========================================================================
-- 1. Kolom
--
-- `on delete set null`, dan ini BUKAN pilihan gaya. tree_plantings ikut terhapus
-- kalau pohon atau kebunnya dihapus (keduanya `on delete cascade`). Dengan
-- cascade, foto akan ikut lenyap; dengan `set null` fotonya bertahan dan cuma
-- kehilangan penanda siklusnya -- yang artinya persis "siklus tidak diketahui",
-- yaitu makna NULL yang sudah ditetapkan di atas.
-- ===========================================================================

alter table public.photo_attachments
  add column if not exists planting_id uuid
    references public.tree_plantings(id) on delete set null;

comment on column public.photo_attachments.planting_id is
  'Siklus tanam pemilik foto. NULL = siklus TIDAK DIKETAHUI, bukan milik siklus lain -- foto ber-NULL tetap wajib ditampilkan. Selalu NULL untuk task_proof: satu aktivitas bisa menyentuh banyak pohon sekaligus.';

-- Penyaringan selalu berpasangan dengan entity_id, jadi index-nya majemuk.
-- Parsial: baris ber-NULL tidak pernah dicari lewat kolom ini.
create index if not exists idx_photo_attachments_planting
  on public.photo_attachments (planting_id, entity_type, entity_id)
  where planting_id is not null;

-- ===========================================================================
-- 2. Backfill 'tree_main'
--
-- Subquery berkorelasi, bukan join: yang dicari SATU baris siklus terbaru yang
-- memenuhi syarat, dan `limit 1` di dalam subquery menyatakan itu langsung.
-- Syarat farm_id ikut disertakan sebagai penjagaan -- pohon dan fotonya harus
-- berada di kebun yang sama, dan baris yang tidak memenuhinya lebih baik
-- dibiarkan NULL daripada dipasangkan lintas kebun.
-- ===========================================================================

update public.photo_attachments pa
set planting_id = (
  select tp.id
  from public.tree_plantings tp
  where tp.tree_id = pa.entity_id
    and tp.farm_id = pa.farm_id
    and tp.created_at <= pa.created_at
  order by tp.created_at desc, tp.cycle_no desc
  limit 1
)
where pa.entity_type = 'tree_main'
  and pa.planting_id is null;

-- ===========================================================================
-- 3. Backfill 'condition_record'
--
-- Waktu acuannya milik CATATAN, bukan milik foto. Foto bisa diunggah jauh
-- sesudah catatannya dibuat -- jalur coba-lagi di layar catat kondisi memang
-- membolehkannya -- dan yang menentukan pohon mana yang diamati adalah kapan
-- catatannya dibuat, bukan kapan fotonya berhasil naik.
-- ===========================================================================

update public.photo_attachments pa
set planting_id = (
  select tp.id
  from public.tree_condition_reports tcr
  join public.tree_plantings tp
    on tp.tree_id = tcr.tree_id
   and tp.farm_id = tcr.farm_id
  where tcr.id = pa.entity_id
    and tcr.farm_id = pa.farm_id
    and tp.created_at <= tcr.created_at
  order by tp.created_at desc, tp.cycle_no desc
  limit 1
)
where pa.entity_type = 'condition_record'
  and pa.planting_id is null;

-- ===========================================================================
-- 4. Jalur tulis: diturunkan database, bukan dikirim klien
--
-- KENAPA TRIGGER, BUKAN KLIEN.
--
-- Unggah berjalan dua langkah dari klien: storage.upload lalu INSERT langsung
-- ke photo_attachments lewat PostgREST. Bukan RPC, dan memindahkannya ke RPC
-- adalah perubahan besar di luar lingkup migrasi ini.
--
-- Policy INSERT (053 E.1) memeriksa uploaded_by, bucket, dan kecocokan segmen
-- path -- ia TIDAK memeriksa planting_id dan tidak akan diubah untuk itu.
-- Artinya kalau kolom ini dipercayakan ke klien, klien bisa mengirim nilai apa
-- pun yang lolos FK, termasuk siklus milik pohon atau kebun lain.
--
-- Trigger ini menutup celah itu dengan cara paling sederhana yang tersedia:
-- ia MENIMPA apa pun yang dikirim klien, selalu. Tidak ada "isi kalau NULL" --
-- itu akan menyisakan persis celah yang sedang ditutup. Akibat sampingannya
-- justru menyenangkan: sisi klien tidak perlu mengirim kolom ini sama sekali.
--
-- SECURITY INVOKER (bawaan), dan itu disengaja. Pengunggah dijamin anggota
-- aktif kebun itu oleh policy INSERT, dan anggota aktif memang boleh membaca
-- tree_plantings (055:171-177) serta tree_condition_reports. Jadi tidak ada
-- yang perlu ditembus. SECURITY DEFINER akan menambah permukaan penyelidikan
-- tanpa memberi kemampuan apa pun yang belum ada.
-- ===========================================================================

create or replace function public.set_photo_attachment_planting()
returns trigger
language plpgsql
as $$
declare
  v_tree_id uuid;
  v_at timestamptz;
begin
  -- task_proof: satu aktivitas bisa menyentuh banyak pohon, jadi satu siklus
  -- tidak pernah bisa mewakilinya. Dipaksa NULL, termasuk kalau klien mengirim
  -- nilai.
  if new.entity_type = 'task_proof' then
    new.planting_id := null;
    return new;
  end if;

  if new.entity_type = 'tree_main' then
    v_tree_id := new.entity_id;
    -- Default kolom sudah terpasang sebelum trigger BEFORE baris ini jalan,
    -- jadi created_at pasti terisi; coalesce hanya jaga-jaga.
    v_at := coalesce(new.created_at, now());

  elsif new.entity_type = 'condition_record' then
    select tcr.tree_id, tcr.created_at
    into v_tree_id, v_at
    from public.tree_condition_reports tcr
    where tcr.id = new.entity_id
      and tcr.farm_id = new.farm_id;

  else
    -- entity_type di luar ketiganya tidak akan lolos
    -- photo_attachments_entity_type_check, tapi cabang ini membuat fungsinya
    -- tetap benar kalau daftar itu suatu saat bertambah.
    new.planting_id := null;
    return new;
  end if;

  if v_tree_id is null or v_at is null then
    new.planting_id := null;
    return new;
  end if;

  -- Aturannya SAMA PERSIS dengan bagian 2 dan 3. Kalau salah satunya diubah,
  -- yang lain wajib ikut -- kalau tidak, foto lama dan foto baru akan
  -- ditempatkan dengan dua aturan berbeda dan tidak ada yang menyadarinya.
  select tp.id
  into new.planting_id
  from public.tree_plantings tp
  where tp.tree_id = v_tree_id
    and tp.farm_id = new.farm_id
    and tp.created_at <= v_at
  order by tp.created_at desc, tp.cycle_no desc
  limit 1;

  return new;
end;
$$;

drop trigger if exists set_photo_attachment_planting_trigger on public.photo_attachments;

create trigger set_photo_attachment_planting_trigger
before insert on public.photo_attachments
for each row
execute function public.set_photo_attachment_planting();

-- ===========================================================================
-- 5. Laporan hasil backfill
--
-- Jumlahnya hanya bisa dilihat di sini. Membacanya dari luar butuh service_role,
-- dan suite tes proyek ini sengaja hanya memakai anon key -- lewat RLS, satu
-- sesi hanya melihat foto kebun yang ia ikuti, jadi tidak ada cara menghitung
-- seluruhnya dari sisi klien.
--
-- Angka-angka ini yang dilaporkan balik ke Riss setelah `supabase db push`.
-- ===========================================================================

do $$
declare
  v_total bigint;
  v_filled bigint;
  v_null_task bigint;
  v_null_tree_main bigint;
  v_null_condition bigint;
begin
  select count(*) into v_total from public.photo_attachments;

  select count(*) into v_filled
  from public.photo_attachments where planting_id is not null;

  select count(*) into v_null_task
  from public.photo_attachments
  where entity_type = 'task_proof';

  select count(*) into v_null_tree_main
  from public.photo_attachments
  where entity_type = 'tree_main' and planting_id is null;

  select count(*) into v_null_condition
  from public.photo_attachments
  where entity_type = 'condition_record' and planting_id is null;

  raise notice '--- 059 backfill planting_id ---';
  raise notice 'total baris foto            : %', v_total;
  raise notice 'terisi (backfill berhasil)  : %', v_filled;
  raise notice 'NULL - task_proof (memang)  : %', v_null_task;
  raise notice 'NULL - tree_main            : %', v_null_tree_main;
  raise notice 'NULL - condition_record     : %', v_null_condition;
  raise notice 'NULL berarti siklus tidak diketahui. Foto ber-NULL TETAP ditampilkan.';
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFIKASI SESUDAH PUSH (jalankan manual, di luar migrasi)
--
--   -- tidak boleh ada satu pun task_proof yang terisi
--   select count(*) from public.photo_attachments
--   where entity_type = 'task_proof' and planting_id is not null;   -- harus 0
--
--   -- tidak boleh ada foto yang siklusnya milik pohon/kebun lain
--   select count(*)
--   from public.photo_attachments pa
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where tp.farm_id <> pa.farm_id;                                  -- harus 0
--
--   -- tree_main: siklusnya harus milik posisi yang sama dengan entity_id
--   select count(*)
--   from public.photo_attachments pa
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where pa.entity_type = 'tree_main' and tp.tree_id <> pa.entity_id; -- harus 0
-- ---------------------------------------------------------------------------
