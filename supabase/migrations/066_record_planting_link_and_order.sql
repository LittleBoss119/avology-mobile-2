-- ===========================================================================
-- 066 -- Penanda siklus pada catatan, dan urutan riwayat kronologis
--
-- KENAPA BERKAS INI ADA: 064 DAN 065 BOCOR.
--
-- Keduanya menyaring catatan fase dan kondisi ke siklus tanam aktif dengan
-- membandingkan TANGGAL:
--
--     (recorded_at at time zone 'Asia/Jakarta')::date >= <awal siklus aktif>
--
-- Tanggal adalah penghubung yang paling kasar yang tersedia saat itu, karena
-- catatan memang tidak punya penanda siklus. Batasnya sudah ditulis terus
-- terang di kepala 064, dan kini terbukti di perangkat: posisi yang ditanami
-- ULANG PADA HARI YANG SAMA dengan catatan pohon sebelumnya membuat catatan
-- lama LOLOS penyaring -- keduanya jatuh pada tanggal yang sama, dan `>=` tidak
-- bisa membedakan "sebelum ditanam ulang" dari "sesudah". Pohon baru mewarisi
-- fase pohon yang mati.
--
-- Perbandingan tanggal tidak bisa diperbaiki dengan mempertajam jamnya: kolom
-- waktu pada catatan diisi klien sebagai TANGGAL SAJA yang di-cast jadi tengah
-- malam, jadi jamnya bukan waktu pencatatan dan tidak membedakan apa pun.
-- Satu-satunya perbaikan yang benar adalah berhenti menebak: simpan siklusnya.
--
-- YANG DIKERJAKAN:
--
--   1. growth_phase_records dan tree_condition_reports mendapat planting_id,
--      diisi trigger, dan kedua recalculate_* beralih ke sana -- MENGGANTIKAN
--      penyaring tanggal dari 064/065, bukan menumpukinya.
--   2. trees mendapat current_growth_phase_since, diisi bersamaan dengan
--      current_growth_phase oleh fungsi yang sama.
--   3. care_activities mendapat created_at, dan tree_history_view membawanya
--      dari keempat cabang supaya riwayat bisa diurut kronologis dalam satu
--      hari.
--
-- Transaksi eksplisit, mengikuti setiap migrasi sejak 031. Ia BUKAN formalitas
-- di berkas ini: bagian 1b mematikan dua trigger untuk sementara, dan rollback
-- adalah satu-satunya yang menjamin keduanya kembali menyala kalau ada yang
-- gagal di tengah. Pola yang sama dipakai 054:133-137.
-- ===========================================================================

begin;


-- ---------------------------------------------------------------------------
-- 1a. Kolom planting_id
--
-- `on delete set null`, mengikuti photo_attachments.planting_id (059:127-128)
-- dan dengan alasan yang sama persis: baris tree_plantings bisa lenyap lewat
-- cascade kalau pohon atau kebunnya dihapus. Dengan cascade, CATATANNYA ikut
-- lenyap -- catatan kondisi dan fase adalah data lapangan yang tidak boleh
-- hilang karena baris administratif di tabel lain hilang. Dengan `set null`,
-- catatannya bertahan dan hanya kehilangan penanda siklusnya.
--
-- NULLABLE, dan NULL punya arti yang tegas: "siklusnya TIDAK DIKETAHUI".
-- Tiga jalur menghasilkannya, semuanya sah:
--   * catatan lama yang tanggalnya mendahului siklus pertama (lihat 1b);
--   * catatan yang dibuat saat posisinya sedang kosong (tidak ada siklus aktif);
--   * siklusnya terhapus lewat cascade di atas.
--
-- BEDA PENTING DARI photo_attachments: di sana NULL berarti "tetap tampilkan"
-- (059:67-77) -- foto yang hilang lebih buruk daripada foto yang salah tampil.
-- Di sini NULL berarti "JANGAN dihitung": kolom turunan current_growth_phase
-- dan current_condition harus menjawab keadaan pohon YANG SEKARANG, dan catatan
-- yang siklusnya tidak diketahui tidak bisa menjaminnya. Kedua aturan itu
-- kebalikan satu sama lain, dan keduanya benar untuk masalahnya masing-masing.
-- Catatan ber-NULL TETAP TAMPIL di riwayat -- tree_history_view tidak menyaring
-- kolom ini sama sekali.
-- ---------------------------------------------------------------------------

alter table public.growth_phase_records
  add column if not exists planting_id uuid
    references public.tree_plantings(id) on delete set null;

alter table public.tree_condition_reports
  add column if not exists planting_id uuid
    references public.tree_plantings(id) on delete set null;

comment on column public.growth_phase_records.planting_id is
  'Siklus tanam pemilik catatan, diisi trigger saat insert. NULL = siklus TIDAK DIKETAHUI, dan catatan ber-NULL TIDAK ikut menentukan trees.current_growth_phase. Tetap tampil di riwayat.';

comment on column public.tree_condition_reports.planting_id is
  'Siklus tanam pemilik catatan, diisi trigger saat insert. NULL = siklus TIDAK DIKETAHUI, dan catatan ber-NULL TIDAK ikut menentukan trees.current_condition. Tetap tampil di riwayat.';

-- Parsial, mengikuti idx_photo_attachments_planting (059:136-138): baris
-- ber-NULL tidak pernah dicari lewat kolom ini. Berpasangan dengan tree_id
-- karena setiap pembacaan menyaring keduanya sekaligus.
create index if not exists idx_growth_phase_records_planting
  on public.growth_phase_records (planting_id, tree_id)
  where planting_id is not null;

create index if not exists idx_tree_condition_reports_planting
  on public.tree_condition_reports (planting_id, tree_id)
  where planting_id is not null;


-- ---------------------------------------------------------------------------
-- 1b. Backfill data lama -- PERKIRAAN, dan disebut begitu
--
-- Baris yang sudah ada tidak punya penanda siklus dan tidak akan pernah punya:
-- informasi itu tidak pernah direkam. Satu-satunya penghubung yang tersedia
-- adalah tanggal -- yaitu ATURAN YANG SAMA PERSIS yang 064 dan 065 pakai, dan
-- yang berkas ini justru sedang membuang untuk data baru:
--
--     awal siklus = coalesce(planted_at, (created_at at time zone 'Asia/Jakarta')::date)
--     catatan milik siklus TERAKHIR yang awalnya <= tanggal WIB catatan itu
--
-- KENAPA PERKIRAAN INI BISA DITERIMA, padahal kebocorannya yang jadi alasan
-- berkas ini ditulis:
--
--   * Ia TIDAK LEBIH BURUK dari keadaan sekarang. Persis aturan ini yang
--     dipakai 064/065 setiap kali recalculate berjalan. Membekukannya jadi
--     kolom tidak menambah satu pun kesalahan baru; ia memindahkan kesalahan
--     yang sudah ada dari waktu-baca ke waktu-tulis.
--   * Ia BERHENTI MEMBURUK. Sesudah ini, setiap catatan BARU mendapat siklus
--     yang sebenarnya dari trigger di 1c. Himpunan baris yang siklusnya hanya
--     tebakan tidak pernah bertambah lagi.
--   * Kesalahannya bisa diperbaiki satu per satu tanpa migrasi: kolomnya nyata,
--     jadi baris yang salah bisa dikoreksi lewat UPDATE bertarget kalau
--     pemiliknya menemukan satu.
--
-- Yang TIDAK diberi nilai: catatan yang tanggalnya MENDAHULUI awal siklus
-- pertama. Ia dibiarkan NULL, bukan dipaksa masuk siklus 1. Itu setia pada
-- aturan 064/065, yang juga tidak pernah menghitungnya. (groupTreeHistoryByCycle
-- di sisi klien memang menaruhnya di siklus 1, tapi itu untuk PEMBATAS BACAAN
-- di riwayat -- di sana lebih baik salah tempat daripada hilang. Di sini
-- taruhannya kebalikannya.)
--
-- Subquery berkorelasi, bukan join, mengikuti backfill 059:150-160: yang dicari
-- SATU baris siklus dan `limit 1` menyatakannya langsung. Syarat farm_id ikut
-- disertakan sebagai penjagaan -- catatan dan siklusnya harus satu kebun, dan
-- baris yang tidak memenuhinya lebih baik NULL daripada dipasangkan lintas kebun.
--
--
-- KENAPA DUA TRIGGER updated_at DIMATIKAN DI SEKELILINGNYA
--
-- set_growth_phase_records_updated_at dan set_tree_condition_reports_updated_at
-- (023:126-137) adalah BEFORE UPDATE yang menulis `new.updated_at = now()` pada
-- SETIAP update, tanpa memeriksa kolom apa yang berubah. Backfill ini menyentuh
-- setiap baris kedua tabel, jadi tanpa dimatikan ia akan menstempel SELURUH
-- catatan kondisi dan fase di aplikasi dengan waktu migrasi dijalankan.
--
-- Itu bukan kerusakan diam-diam melainkan kerusakan yang TERLIHAT: layar detail
-- catatan menampilkan baris "Terakhir diubah" tepat ketika updated_at berbeda
-- dari created_at, jadi setiap catatan yang tidak pernah disunting siapa pun
-- akan mengaku pernah disunting. Kolomnya nullable tanpa default (023:7,15) --
-- NULL berarti "belum pernah diubah", dan nilai itu yang harus dipertahankan.
--
-- Dimatikan lalu dinyalakan kembali DI DALAM transaksi yang sama, persis pola
-- 054:133-137: kalau migrasi ini gagal di antara keduanya, rollback
-- mengembalikan keduanya ke keadaan menyala bersama seluruh perubahan lain.
-- Tidak ada jendela waktu di mana trigger itu mati di database yang sudah
-- di-commit.
--
-- Yang TIDAK ikut dimatikan: sync_tree_current_growth_phase_trigger dan
-- kembarannya untuk kondisi. Keduanya AFTER INSERT saja (006:524-528), jadi
-- UPDATE di bawah tidak membangunkannya sama sekali.
-- ---------------------------------------------------------------------------

alter table public.growth_phase_records disable trigger set_growth_phase_records_updated_at;
alter table public.tree_condition_reports disable trigger set_tree_condition_reports_updated_at;

update public.growth_phase_records gpr
set planting_id = (
  select tp.id
  from public.tree_plantings tp
  where tp.tree_id = gpr.tree_id
    and tp.farm_id = gpr.farm_id
    and coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
        <= (gpr.recorded_at at time zone 'Asia/Jakarta')::date
  order by coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date) desc,
           tp.cycle_no desc
  limit 1
)
where gpr.planting_id is null;

update public.tree_condition_reports tcr
set planting_id = (
  select tp.id
  from public.tree_plantings tp
  where tp.tree_id = tcr.tree_id
    and tp.farm_id = tcr.farm_id
    and coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
        <= (tcr.reported_at at time zone 'Asia/Jakarta')::date
  order by coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date) desc,
           tp.cycle_no desc
  limit 1
)
where tcr.planting_id is null;

alter table public.growth_phase_records enable trigger set_growth_phase_records_updated_at;
alter table public.tree_condition_reports enable trigger set_tree_condition_reports_updated_at;

-- ---------------------------------------------------------------------------
-- 1b-lanjutan. KOREKSI OPSIONAL YANG BELUM DIJALANKAN -- BACA SEBELUM PUSH
--
-- Aturan tanggal di atas TIDAK MEMPERBAIKI baris yang justru jadi alasan
-- berkas ini ditulis, dan itu harus disebut terang-terangan.
--
-- Kasusnya: posisi ditanami ULANG PADA HARI YANG SAMA dengan catatan pohon
-- sebelumnya. Kedua siklus punya awal <= tanggal catatan itu, jadi
-- `order by <awal> desc, cycle_no desc` memilih siklus BARU -- dan catatan milik
-- pohon yang mati diberi planting_id siklus pohon yang baru. Sesudah backfill,
-- recalculate menyaring `planting_id = <siklus aktif>`, catatan lama itu LOLOS,
-- dan pohon baru tetap mewarisi fase pohon mati. Persis kebocoran yang berkas
-- ini ada untuk menutupnya, dibekukan jadi kolom.
--
-- Untuk baris BARU tidak ada persoalan: trigger di 1c memakai ended_at, bukan
-- tanggal. Yang tertinggal hanya baris yang sudah ada saat migrasi ini jalan.
--
-- KOREKSINYA memakai created_at KEDUA SISI, bukan tanggal pilihan pencatat.
-- tree_plantings.created_at dan <tabel>.created_at sama-sama `default now()` --
-- stempel waktu asli dari database, bukan tanggal yang diketik orang. Keduanya
-- membedakan "sebelum ditanam ulang" dari "sesudah" walau harinya sama. Ini
-- juga persis aturan yang dipakai set_photo_attachment_planting (061:679-687)
-- dan backfill 059 untuk masalah yang sama.
--
-- Aman dipakai di sini karena 054:117-135 MENGHAPUS seluruh isi kedua tabel ini
-- beserta trees, jadi tidak ada baris tersisa yang created_at-nya berasal dari
-- backfill kolom 023 (yang menstempel semua baris dengan satu waktu yang sama).
-- Setiap baris yang ada sekarang punya created_at yang sungguhan.
--
-- SENGAJA DIBIARKAN SEBAGAI KOMENTAR: bentuk backfill yang dipakai berkas ini
-- adalah yang disetujui, dan mengganti aturannya sendiri di menit terakhir
-- bukan keputusan yang boleh diambil di sini. Kalau pemiliknya setuju, hapus
-- tanda komentar pada kedua UPDATE di bawah -- keduanya idempoten dan boleh
-- dijalankan terpisah sesudah migrasi ini, asalkan bagian 7 (backfill trees)
-- ikut dijalankan ulang sesudahnya.
--
--   update public.growth_phase_records gpr
--   set planting_id = (
--     select tp.id
--     from public.tree_plantings tp
--     where tp.tree_id = gpr.tree_id
--       and tp.farm_id = gpr.farm_id
--       and tp.created_at <= gpr.created_at
--     order by tp.created_at desc, tp.cycle_no desc
--     limit 1
--   );
--
--   update public.tree_condition_reports tcr
--   set planting_id = (
--     select tp.id
--     from public.tree_plantings tp
--     where tp.tree_id = tcr.tree_id
--       and tp.farm_id = tcr.farm_id
--       and tp.created_at <= tcr.created_at
--     order by tp.created_at desc, tp.cycle_no desc
--     limit 1
--   );
--
-- Untuk MENGHITUNG dulu berapa baris yang terdampak sebelum memutuskan --
-- baris yang kedua aturan itu tempatkan berbeda:
--
--   select count(*) from public.growth_phase_records gpr
--   where gpr.planting_id is distinct from (
--     select tp.id from public.tree_plantings tp
--     where tp.tree_id = gpr.tree_id and tp.farm_id = gpr.farm_id
--       and tp.created_at <= gpr.created_at
--     order by tp.created_at desc, tp.cycle_no desc limit 1
--   );
--
-- 0 berarti tidak ada posisi yang pernah ditanami ulang pada hari yang sama,
-- dan aturan tanggal sudah cukup untuk seluruh data yang ada.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1c. Jalur tulis: diturunkan database, bukan dikirim klien
--
-- Bentuknya mengikuti set_photo_attachment_planting (061:592-693): trigger
-- BEFORE INSERT yang MENIMPA new.planting_id apa pun yang dikirim pemanggil.
-- Menimpa, bukan menghormati: kedua tabel ini ditulis lewat INSERT LANGSUNG dari
-- PostgREST (conditionReportService dan growthPhaseService melakukannya, bukan
-- lewat RPC), dan policy INSERT-nya memeriksa keanggotaan kebun -- ia tidak
-- memeriksa planting_id dan tidak akan diubah untuk itu. Kalau kolom ini
-- dipercayakan ke klien, klien bisa mengirim siklus milik pohon mana pun yang
-- lolos FK.
--
--
-- DUA HAL YANG SENGAJA BERBEDA DARI 061, keduanya beralasan:
--
-- (1) ATURAN PEMILIHAN SIKLUSNYA: `ended_at is null`, BUKAN
--     `created_at <= v_at order by created_at desc`.
--
--     061 menyelesaikan foto yang bisa menempel pada catatan LAMA, jadi ia
--     harus bertanya "siklus mana yang berjalan PADA SAAT ITU" dan menjawabnya
--     dari tanggal. Trigger ini hanya pernah melihat baris yang sedang dibuat
--     SEKARANG, jadi pertanyaannya lebih sederhana dan jawabannya tersimpan:
--     siklus yang ended_at-nya masih NULL. Tunggal, dijamin partial unique index
--     tree_plantings_one_active_per_tree (055:1f).
--
--     Inilah inti seluruh berkas ini. Memakai bentuk tanggal 061 di sini akan
--     mewarisi kembali kebocoran yang sama: pada hari penanaman ulang, kedua
--     siklus punya tanggal yang sama dan urutannya jadi tebakan.
--
--     Akibat sampingannya disebut: catatan yang dibuat saat posisi SEDANG
--     KOSONG mendapat NULL, bukan siklus terakhir yang sudah ditutup. Itu benar
--     -- catatan itu memang bukan milik siklus mana pun. Layar sudah
--     menyembunyikan tombol "Catat" pada posisi kosong, jadi jalur ini hanya
--     terbuka lewat pemanggilan langsung; NULL adalah jawaban yang jujur untuknya.
--
-- (2) SECURITY DEFINER, sementara 061 SECURITY INVOKER.
--
--     Fungsi ini membaca tree_plantings, yang ber-RLS dengan policy SELECT
--     is_active_farm_member (055:171-175). Sebagai INVOKER ia akan berjalan --
--     yang boleh menyisipkan catatan pasti anggota aktif kebun itu, jadi
--     policynya lolos hari ini.
--
--     Yang membuatnya tetap dipilih DEFINER adalah BENTUK KEGAGALANNYA kalau
--     suatu saat policy itu dipersempit. 061 sudah menulis peringatan yang sama
--     untuk dirinya sendiri (061:576-587). Bedanya akibat: pada foto, planting_id
--     yang gagal terisi berarti NULL, dan NULL di sana berarti "tetap tampilkan"
--     -- tidak ada yang hilang. Di sini NULL berarti "jangan dihitung", sehingga
--     catatan yang baru saja ditulis pekerja DIAM-DIAM tidak mengubah kondisi
--     atau fase pohonnya. Kegagalan senyap yang mengubah data turunan lebih
--     buruk daripada kegagalan senyap yang cuma menampilkan lebih banyak.
--
--     Aman: fungsi ini tidak menerima masukan bebas, hanya membaca satu baris
--     tree_plantings yang tree_id DAN farm_id-nya sama dengan baris yang sedang
--     disisipkan, dan tidak pernah menuliskan apa pun ke tabel lain.
--
--
-- SATU FUNGSI untuk dua tabel. Keduanya punya tree_id dan farm_id NOT NULL
-- dengan arti yang sama, jadi badannya tidak perlu tahu ia sedang dipasang di
-- tabel mana. Dua fungsi kembar hanya menyediakan tempat untuk menyimpang.
--
-- HANYA BEFORE INSERT, bukan juga UPDATE. Sebuah catatan tetap milik siklus
-- tempat ia dibuat; mengoreksi tanggal atau isinya lewat update_own_*_record
-- tidak memindahkannya ke siklus lain. Trigger pada UPDATE justru akan
-- MEMINDAHKANNYA -- catatan lama yang dikoreksi hari ini akan direbut siklus
-- yang aktif hari ini.
-- ---------------------------------------------------------------------------

create or replace function public.set_tree_record_planting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  -- Tidak ketemu -> NULL, dan itu jawaban yang benar untuk posisi kosong.
  select tp.id
  into new.planting_id
  from public.tree_plantings tp
  where tp.tree_id = new.tree_id
    and tp.farm_id = new.farm_id
    and tp.ended_at is null;

  return new;
end;
$$;

drop trigger if exists set_growth_phase_record_planting_trigger on public.growth_phase_records;

create trigger set_growth_phase_record_planting_trigger
before insert on public.growth_phase_records
for each row
execute function public.set_tree_record_planting();

drop trigger if exists set_tree_condition_report_planting_trigger on public.tree_condition_reports;

create trigger set_tree_condition_report_planting_trigger
before insert on public.tree_condition_reports
for each row
execute function public.set_tree_record_planting();


-- ---------------------------------------------------------------------------
-- 2. trees.current_growth_phase_since
--
-- Tanggal mulai fase yang sedang berlaku. Diisi fungsi yang sama yang mengisi
-- current_growth_phase, dalam SELECT yang sama, dari BARIS yang sama.
--
-- Itu jaminannya, dan itu satu-satunya alasan kolom ini ada: layar detail pohon
-- perlu menampilkan umur fase, dan menghitungnya di klien dari daftar riwayat
-- berarti menulis ulang penyaringan siklus di tempat kedua. Tempat kedua sudah
-- terbukti menyimpang -- klien sempat menghitung umur fase dari catatan pohon
-- siklus SEBELUMNYA sementara database sudah menyaringnya dengan benar. Dua
-- kolom yang lahir dari satu baris tidak bisa berbeda.
--
-- date, bukan timestamptz: yang dipakai hanya selisih HARI, dan recorded_at
-- sendiri diisi klien sebagai tanggal saja (jamnya konstan, bukan waktu
-- pencatatan). Menyimpan timestamptz akan menjanjikan ketelitian yang datanya
-- tidak punya.
--
-- Turunannya WIB, mengikuti seluruh perhitungan tanggal di skema ini.
-- ---------------------------------------------------------------------------

alter table public.trees
  add column if not exists current_growth_phase_since date;

comment on column public.trees.current_growth_phase_since is
  'Tanggal WIB catatan fase yang menetapkan current_growth_phase. Selalu diisi bersamaan dengan kolom itu oleh recalculate_tree_current_growth_phase; NULL persis ketika current_growth_phase NULL.';


-- ---------------------------------------------------------------------------
-- 3. recalculate_tree_current_growth_phase -- planting_id menggantikan tanggal
--
-- Penyaring tanggal dari 064 DICABUT, bukan ditambahi. Menumpuk keduanya akan
-- menyisakan dua aturan yang harus sama-sama benar selamanya, dan yang lebih
-- lemah (tanggal) tidak menambah apa pun di atas yang lebih kuat (planting_id).
--
-- Variabel active_start ikut hilang bersamanya; penggantinya active_planting_id.
-- Sisa badannya -- urutan, penjaga `if ... is not null`, dan UPDATE penutup --
-- tetap seperti 064.
--
-- Catatan ber-planting_id NULL otomatis tersaring: `planting_id = <uuid>`
-- bernilai NULL untuk baris itu, bukan true. Itu perilaku yang diinginkan, dan
-- ditulis di sini supaya tidak ada yang "memperbaikinya" jadi
-- `is not distinct from`.
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
  latest_phase_since date;
  active_planting_id uuid;
begin
  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  select tp.id
  into active_planting_id
  from public.tree_plantings tp
  where tp.tree_id = p_tree_id
    and tp.ended_at is null;

  -- Posisi kosong: tidak ada pohon yang bisa punya fase. Select di bawah
  -- SENGAJA dilewati alih-alih dibiarkan berjalan dengan pembanding NULL --
  -- hasilnya sama, tapi niatnya jadi terbaca.
  if active_planting_id is not null then
    -- Fase DAN tanggalnya dari SATU baris yang sama. Bukan dua select: dua
    -- select bisa mengembalikan baris berbeda kalau ada yang menyisip di
    -- antaranya, dan kedua kolom itu justru ada untuk selalu cocok.
    select phase, (recorded_at at time zone 'Asia/Jakarta')::date
    into latest_phase, latest_phase_since
    from public.growth_phase_records
    where tree_id = p_tree_id
      and is_deleted = false
      and planting_id = active_planting_id
    order by recorded_at desc, created_at desc, id desc
    limit 1;
  end if;

  update public.trees
  set current_growth_phase = latest_phase,
      current_growth_phase_since = latest_phase_since,
      updated_at = now()
  where id = p_tree_id;
end;
$$;

revoke execute on function public.recalculate_tree_current_growth_phase(uuid)
  from public, anon;


-- ---------------------------------------------------------------------------
-- 4. recalculate_tree_current_condition -- planting_id menggantikan tanggal
--
-- Perubahannya sepadan dengan bagian 3, dan sengaja dibuat sepadan sampai ke
-- bentuk penjaganya.
--
-- coalesce(latest_condition, 'healthy') DIPERTAHANKAN. Ia bukan pilihan gaya:
-- trees.current_condition adalah `not null default 'healthy'` (003:9), jadi
-- menulis NULL ke sana melanggar constraint dan menggagalkan setiap penanaman
-- ulang. Tidak ada padanan current_growth_phase_since untuk kondisi -- tidak
-- ada yang memintanya, dan kolom turunan yang tidak dibaca siapa pun hanya
-- menambah sesuatu yang harus dijaga tetap benar.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_tree_current_condition(
  p_tree_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_condition public.tree_condition_status;
  active_planting_id uuid;
begin
  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  select tp.id
  into active_planting_id
  from public.tree_plantings tp
  where tp.tree_id = p_tree_id
    and tp.ended_at is null;

  if active_planting_id is not null then
    select condition_status
    into latest_condition
    from public.tree_condition_reports
    where tree_id = p_tree_id
      and is_deleted = false
      and planting_id = active_planting_id
    order by reported_at desc, created_at desc, id desc
    limit 1;
  end if;

  update public.trees
  set current_condition = coalesce(latest_condition, 'healthy'::public.tree_condition_status),
      updated_at = now()
  where id = p_tree_id;
end;
$$;

revoke execute on function public.recalculate_tree_current_condition(uuid)
  from public, anon;


-- ---------------------------------------------------------------------------
-- 5. care_activities.created_at
--
-- Satu-satunya dari empat tabel catatan yang tidak punya kolom ini -- diperiksa
-- langsung di 004:168-176, dan sudah dicatat dua kali sebelumnya (060:439,
-- 061:544). Akibatnya riwayat pohon tidak bisa diurutkan kronologis di dalam
-- satu hari: happened_at pada keempat cabang berisi tanggal yang di-cast jadi
-- tengah malam, jadi seluruh catatan sehari punya nilai IDENTIK, dan tiga
-- cabang punya created_at sebagai pemecah seri sementara satu tidak.
--
-- TIGA LANGKAH, bukan satu `add column ... not null default now()`.
-- Bentuk satu langkah akan mengisi SELURUH baris lama dengan waktu migrasi
-- dijalankan -- yaitu satu nilai yang sama untuk semuanya, yang justru
-- menghapus urutan yang sedang dicoba dipulihkan. Nilai yang benar untuk baris
-- lama adalah performed_at: ia satu-satunya jejak waktu yang mereka punya.
--
-- performed_at not null (004:175), jadi tidak ada baris yang tersisa NULL dan
-- `set not null` di langkah ketiga pasti lolos.
--
-- INI SATU-SATUNYA PERUBAHAN PADA care_activities. Tabel itu append-only
-- (043:6) dan tidak ada di berkas ini yang menyentuh baris, policy, atau
-- kolom lainnya.
-- ---------------------------------------------------------------------------

alter table public.care_activities
  add column if not exists created_at timestamptz;

update public.care_activities
set created_at = performed_at
where created_at is null;

alter table public.care_activities
  alter column created_at set default now(),
  alter column created_at set not null;

comment on column public.care_activities.created_at is
  'Waktu baris ini ditulis. Baris sebelum migrasi 066 diisi dari performed_at -- untuk baris itu nilainya perkiraan, bukan waktu tulis sebenarnya.';


-- ---------------------------------------------------------------------------
-- 6. tree_history_view -- kolom `dibuat_pada`
--
-- Membawa created_at dari keempat cabang, supaya klien bisa mengurutkan
-- kronologis di dalam satu hari tanpa menebak. Namanya bahasa Indonesia,
-- mengikuti asal, produk, dan kategori yang sudah lebih dulu ada di view ini --
-- dan mengikuti label yang sudah dipakai layar detail catatan untuk kolom yang
-- sama persis, "Dibuat pada".
--
-- `dibuat_pada` BUKAN pengganti `happened_at`, dan tidak boleh diperlakukan
-- begitu. Keduanya menjawab pertanyaan berbeda:
--   happened_at  = KAPAN KEJADIANNYA, dipilih pencatat, boleh dimundurkan.
--   dibuat_pada  = KAPAN BARISNYA DITULIS, tidak bisa dipilih siapa pun.
-- Riwayat tetap diurutkan menurut happened_at; dibuat_pada hanya pemecah seri
-- di bawahnya.
--
-- create or replace, TIDAK di-drop. Alasannya sama seperti 065: view ini punya
-- `with (security_invoker = true)` (028:26-27) dan `grant select ... to
-- authenticated` (028:103), dan keduanya hilang diam-diam kalau view di-drop.
-- security_invoker yang hilang berarti view berjalan sebagai pemiliknya dan
-- melewati RLS -- kebocoran data lintas kebun. `create or replace` menolak
-- perubahan pada kolom lama tapi mengizinkan kolom baru di UJUNG; sebelas kolom
-- lama disalin apa adanya dari 065:342-431, `dibuat_pada` menyusul sesudah
-- `kategori`.
--
-- Keempat sumbernya timestamptz, jadi tidak ada cast yang diperlukan:
--   tree_condition_reports.created_at (023:6)
--   growth_phase_records.created_at   (023:14)
--   care_activities.created_at        (bagian 5 di atas)
--   harvest_records.created_at        (020:43)
-- ---------------------------------------------------------------------------

create or replace view public.tree_history_view as
 select tcr.id as source_id,
    tcr.tree_id,
    tcr.farm_id,
    'condition'::text as history_type,
    tcr.condition_status::text as title,
    tcr.note as description,
    tcr.reported_by as actor_id,
    tcr.reported_at as happened_at,
    null::text as asal,
    null::text as produk,
    null::text as kategori,
    tcr.created_at as dibuat_pada
   from tree_condition_reports tcr
  where tcr.is_deleted = false
union all
 select gpr.id as source_id,
    gpr.tree_id,
    gpr.farm_id,
    'phase'::text as history_type,
    gpr.phase::text as title,
    gpr.note as description,
    gpr.recorded_by as actor_id,
    gpr.recorded_at as happened_at,
    null::text as asal,
    null::text as produk,
    null::text as kategori,
    gpr.created_at as dibuat_pada
   from growth_phase_records gpr
  where gpr.is_deleted = false
union all
 select ca.id as source_id,
    cat.tree_id,
    ca.farm_id,
    'care'::text as history_type,
    coalesce(ct.title, 'Perawatan inisiatif'::text) as title,
    coalesce(nullif(trim(both from ca.note), ''::text), ca.category::text) as description,
    ca.performed_by as actor_id,
    ca.performed_at as happened_at,
    ca.asal,
    nullif(trim(both from ca.produk), ''::text) as produk,
    ca.category::text as kategori,
    ca.created_at as dibuat_pada
   from care_activities ca
     join care_activity_trees cat on cat.care_activity_id = ca.id
     left join care_tasks ct on ct.id = ca.care_task_id
union all
 select hr.id as source_id,
    hr.tree_id,
    hr.farm_id,
    'harvest'::text as history_type,
    'Panen dicatat'::text as title,
    nullif(
      concat_ws('. ',
        nullif(
          concat_ws(', ',
            case
              when hr.fruit_count is not null then concat('Jumlah buah: ', hr.fruit_count::text)
              else null::text
            end,
            case
              when hr.harvest_weight_kg is not null then concat(
                'Berat: ',
                trim(trailing '.' from trim(trailing '0' from hr.harvest_weight_kg::text)),
                ' kg'
              )
              else null::text
            end
          ),
          ''::text
        ),
        case
          when nullif(trim(both from hr.fruit_condition), ''::text) is not null
            then concat('Kondisi: ', trim(both from hr.fruit_condition))
          else null::text
        end,
        case
          when nullif(trim(both from hr.note), ''::text) is not null
            then concat('Catatan: ', trim(both from hr.note))
          else null::text
        end
      ),
      ''::text
    ) as description,
    hr.harvested_by as actor_id,
    hr.harvested_at as happened_at,
    null::text as asal,
    null::text as produk,
    null::text as kategori,
    hr.created_at as dibuat_pada
   from harvest_records hr
  where hr.is_deleted = false;

comment on view public.tree_history_view is
  'Riwayat satu pohon dari empat tabel catatan. kategori (065) hanya terisi pada cabang perawatan. dibuat_pada (066) adalah waktu baris ditulis -- pemecah seri kronologis untuk happened_at, yang pada seluruh cabang berisi tanggal yang di-cast jadi tengah malam.';


-- ---------------------------------------------------------------------------
-- 7. Backfill kolom turunan di trees
--
-- Kondisi dan fase dihitung ulang untuk SELURUH baris trees, lewat pemanggilan
-- kedua fungsi -- bukan UPDATE yang mengulang logikanya. Wajib di berkas ini,
-- bukan sekadar rapi: aturan penyaringnya baru saja berganti dari tanggal ke
-- planting_id, jadi setiap baris yang nilainya diturunkan aturan lama harus
-- ditinjau ulang. current_growth_phase_since juga baru lahir dan seluruhnya
-- masih NULL sampai loop ini jalan.
--
--
-- PERINGATAN 064 MASIH BERLAKU, dan konsekuensinya sama beratnya.
-- validate_tree_position_trigger (054:306-310) berbunyi pada SETIAP update ke
-- trees, bukan hanya saat posisinya berubah. Ia membandingkan
-- row_position/column_position dengan grid_rows/grid_columns kebunnya dan
-- melempar exception kalau lewat batas. Loop di bawah menulis ke SELURUH baris
-- trees, jadi satu baris di luar batas membatalkan migrasi ini.
--
-- Jalurnya tertutup lewat cara yang didukung: set_farm_grid menolak pengecilan
-- selama masih ada pohon di luar ukuran baru (063:114-127), dan seluruh baris
-- trees sekarang lahir sesudah 054 mengosongkan tabelnya (054:135). Yang tidak
-- bisa dijamin dari sini adalah grid_rows/grid_columns yang pernah diubah lewat
-- UPDATE langsung ke farms di SQL editor. Kalau itu mungkin pernah terjadi,
-- jalankan ini SEBELUM push -- harus 0:
--
--   select count(*)
--   from public.trees t
--   join public.farms f on f.id = t.farm_id
--   where t.row_position > f.grid_rows
--      or (ascii(t.column_position) - 64) > f.grid_columns;
--
--
-- YANG BERUBAH SETELAH LOOP INI, di luar yang sudah dibawa 064/065:
--
--   * Pohon yang ditanami ulang PADA HARI YANG SAMA dengan catatan pohon
--     sebelumnya berhenti mewarisi fase dan kondisi pohon itu. Inilah kebocoran
--     yang jadi alasan berkas ini ada.
--   * Catatan yang backfill 1b tidak bisa tempatkan (tanggalnya mendahului
--     siklus pertama) berhenti dihitung. Sebelumnya ia juga tidak dihitung oleh
--     064/065, jadi ini bukan perubahan -- hanya alasannya yang berpindah dari
--     perbandingan tanggal ke planting_id NULL.
--   * current_growth_phase_since terisi untuk setiap pohon yang punya fase.
-- ---------------------------------------------------------------------------

do $$
declare
  tree_row record;
begin
  for tree_row in select id from public.trees loop
    perform public.recalculate_tree_current_condition(tree_row.id);
    perform public.recalculate_tree_current_growth_phase(tree_row.id);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. Muat ulang cache schema PostgREST
--
-- WAJIB: tree_history_view bertambah kolom, trees bertambah kolom, dan dua tabel
-- catatan bertambah kolom. PostgREST menolak kolom yang belum dikenal cache-nya.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

commit;


-- ===========================================================================
-- VERIFIKASI MANUAL (jalankan sesudah push; tidak dijalankan otomatis)
--
-- 1. Trigger terpasang pada kedua tabel, BEFORE INSERT saja:
--
--      select c.relname, t.tgname, pg_get_triggerdef(t.oid)
--      from pg_trigger t join pg_class c on c.oid = t.tgrelid
--      where c.relname in ('growth_phase_records', 'tree_condition_reports')
--        and not t.tgisinternal
--      order by c.relname, t.tgname;
--
--    -> masing-masing punya set_*_planting_trigger, definisinya BEFORE INSERT.
--
-- 2. Kebocoran hari-yang-sama benar-benar tertutup. Pada satu posisi uji:
--
--      -- catat fase, lalu tutup dan tanam ulang pada TANGGAL YANG SAMA
--      select public.end_tree_planting('<tree>', 'mati', current_date);
--      select public.start_tree_planting('<tree>', 'Miki', current_date);
--      select current_growth_phase, current_growth_phase_since, current_condition
--      from public.trees where id = '<tree>';
--
--    -> NULL, NULL, 'healthy'. Sebelum 066 fase lama akan bertahan di sini.
--
-- 3. Catatan baru mendapat siklus aktif, bukan NULL:
--
--      insert into public.growth_phase_records (farm_id, tree_id, recorded_by, phase)
--      values ('<farm>', '<tree>', '<user>', 'vegetative') returning planting_id;
--
--    -> planting_id = id siklus yang ended_at-nya NULL.
--
-- 4. current_growth_phase_since selalu sejalan dengan current_growth_phase:
--
--      select count(*) from public.trees
--      where (current_growth_phase is null) <> (current_growth_phase_since is null);
--
--    -> harus 0.
--
-- 5. Tidak ada catatan ber-planting_id milik pohon yang berbeda:
--
--      select count(*) from public.growth_phase_records gpr
--      join public.tree_plantings tp on tp.id = gpr.planting_id
--      where tp.tree_id <> gpr.tree_id;
--
--      select count(*) from public.tree_condition_reports tcr
--      join public.tree_plantings tp on tp.id = tcr.planting_id
--      where tp.tree_id <> tcr.tree_id;
--
--    -> keduanya 0.
--
-- 5b. Backfill TIDAK menstempel updated_at. Catatan yang tidak pernah disunting
--     harus tetap ber-updated_at NULL, kalau tidak layar detail catatan akan
--     memunculkan baris "Terakhir diubah" palsu di semuanya:
--
--      select count(*) from public.growth_phase_records where updated_at is not null;
--      select count(*) from public.tree_condition_reports where updated_at is not null;
--
--    -> hanya sebanyak catatan yang memang pernah diedit lewat
--       update_own_*_record. Kalau angkanya sama dengan jumlah seluruh baris,
--       kedua trigger updated_at TIDAK mati saat backfill dan datanya perlu
--       diperbaiki.
--
--    Sekaligus pastikan keduanya menyala kembali:
--
--      select c.relname, t.tgname, t.tgenabled
--      from pg_trigger t join pg_class c on c.oid = t.tgrelid
--      where t.tgname in ('set_growth_phase_records_updated_at',
--                         'set_tree_condition_reports_updated_at');
--
--    -> tgenabled = 'O' (menyala) untuk keduanya.
--
-- 6. care_activities.created_at terisi seluruhnya dan tidak seragam:
--
--      select count(*) as total,
--             count(*) filter (where created_at is null) as kosong,
--             count(distinct created_at) as nilai_berbeda
--      from public.care_activities;
--
--    -> kosong = 0. nilai_berbeda > 1 kalau memang ada baris dari hari berbeda.
--
-- 7. Kolom dibuat_pada terisi di keempat cabang:
--
--      select history_type, count(*) filter (where dibuat_pada is not null) as terisi
--      from public.tree_history_view group by history_type order by history_type;
--
--    -> keempatnya terisi penuh.
--
-- 8. View masih security_invoker dan masih terbaca authenticated:
--
--      select relname, reloptions from pg_class where relname = 'tree_history_view';
--      select has_table_privilege('authenticated', 'public.tree_history_view', 'select');
--
--    -> reloptions memuat security_invoker=true; privilege true.
-- ===========================================================================
