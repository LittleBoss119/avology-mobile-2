-- 055_tree_planting_cycle.sql
--
-- Posisi tanam dipisahkan dari penanamannya.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Sejak migrasi 054, tree_code adalah POSISI TANAM ('1-A'), bukan identitas
-- sebatang pohon. Satu posisi bisa ditanami berkali-kali seumur hidup kebun:
-- pohon mati diganti bibit baru, kadang varietas berbeda.
--
-- Tetapi variety dan planted_at masih melekat di trees. Akibatnya penanaman
-- ulang MENIMPA data pohon sebelumnya -- tanggal tanam pohon lama hilang, dan
-- riwayat dua pohon yang berbeda menyatu di satu timeline tanpa ada yang bisa
-- memisahkannya lagi.
--
-- Migrasi ini memindahkan keduanya ke tree_plantings, satu baris per siklus.
-- trees menjadi murni POSISI; tree_plantings menjadi APA yang tumbuh di sana
-- dan KAPAN.
--
-- ---------------------------------------------------------------------------
-- PENJAGAAN STRUKTURAL YANG PALING PENTING
--
-- Partial unique index tree_plantings_one_active_per_tree (bagian 1e):
--
--     unique (tree_id) where ended_at is null
--
-- Tanpa dia, satu posisi bisa punya DUA pohon hidup sekaligus, dan tidak ada
-- satu pun jalur baca yang bisa menentukan mana yang sedang tumbuh. Ketiga RPC
-- di bawah bersandar padanya: masing-masing menganggap "siklus aktif" bermakna
-- tunggal. Kalau index ini gagal terpasang, JANGAN pakai RPC-nya.
--
-- ---------------------------------------------------------------------------
-- PRASYARAT
--
--   * 054 sudah dijalankan dan terverifikasi.
--   * Tabel trees kosong, sehingga variety/planted_at bisa dibuang tanpa
--     backfill. Kebun, keanggotaan, dan profil tetap ada.
--
-- VERIFIKASI SEBELUM MEN-DROP (sudah dijalankan saat migrasi ini disusun):
-- penelusuran seluruh supabase/migrations/ untuk 'variety' dan 'planted_at'
-- mengembalikan TEPAT DUA kemunculan, keduanya definisi kolomnya sendiri di
-- 003:7-8. Nol view, nol fungsi, nol index membacanya. tree_history_view
-- diperiksa khusus: ia tidak menyentuh tabel trees sama sekali -- keempat
-- cabang union-nya mengambil tree_id dari tree_condition_reports,
-- growth_phase_records, care_activity_trees, dan harvest_records.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * tree_history_view -- pembatas siklus di riwayat dirender sisi aplikasi.
--   * is_archived -- bukan lingkup migrasi ini.
--   * Kondisi pohon. Mencatat kondisi 'mati' TIDAK menutup siklus, dan menutup
--     siklus TIDAK mengubah kondisi. Pemisahan ini disengaja: kondisi adalah
--     pengamatan lapangan yang bisa dikoreksi (recalculate_tree_current_condition
--     menghitung ulang dari catatan terakhir), sedangkan akhir siklus adalah
--     keputusan owner yang tersimpan permanen.
--   * Grant INSERT pada public.trees. Lihat CATATAN LINGKUP di bagian 4.
--   * Penjadwalan multi-pohon, penyaringan pohon mati, pembuatan pohon massal,
--     UI peta denah -- semuanya migrasi berikutnya.

begin;

-- ===========================================================================
-- 1. (1.1) Tabel tree_plantings
-- ===========================================================================

create table if not exists public.tree_plantings (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_no smallint not null,
  variety text,
  planted_at date,
  ended_at date,
  end_reason text,
  ended_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),

  -- 1a -- nomor siklus unik per posisi.
  constraint tree_plantings_unique_cycle_per_tree unique (tree_id, cycle_no),

  -- 1b -- siklus dimulai dari 1.
  constraint tree_plantings_cycle_no_check
    check (cycle_no >= 1),

  -- 1c -- pasangan akhir siklus.
  --
  -- ended_by SENGAJA tidak diwajibkan pada cabang kedua: FK-nya `on delete set
  -- null`, jadi kolom itu bisa jadi NULL sendiri kalau profil pencatatnya
  -- terhapus. Mewajibkannya akan membuat penghapusan profil menabrak constraint
  -- ini dan menggagalkan penghapusan akun.
  constraint tree_plantings_end_pair_check
    check (
      (ended_at is null and end_reason is null and ended_by is null)
      or (ended_at is not null and end_reason is not null)
    ),

  -- 1d -- alasan berakhir. Teks ber-CHECK, bukan enum: daftarnya milik satu
  -- kebun dan bisa berubah, sedangkan enum menuntut migrasi setiap kali
  -- (pertimbangan yang sama dengan grade panen di 045:22-24).
  constraint tree_plantings_end_reason_check
    check (end_reason is null or end_reason in ('mati', 'dibongkar', 'diganti')),

  -- 1e -- siklus tidak bisa berakhir sebelum ditanam.
  constraint tree_plantings_date_order_check
    check (
      ended_at is null
      or planted_at is null
      or ended_at >= planted_at
    )
);

comment on table public.tree_plantings is
  'Satu baris per siklus tanam pada satu posisi. trees adalah POSISI; tabel ini adalah apa yang tumbuh di sana dan kapan.';

comment on column public.tree_plantings.cycle_no is
  'Nomor siklus pada posisi ini, mulai dari 1. Naik setiap kali posisi ditanami ulang.';

comment on column public.tree_plantings.ended_at is
  'NULL berarti siklus masih berjalan. Paling banyak satu baris ber-NULL per tree_id -- ditegakkan tree_plantings_one_active_per_tree.';

-- 1f -- PALING BANYAK SATU SIKLUS AKTIF PER POSISI.
--
-- Harus partial unique INDEX, bukan constraint: UNIQUE constraint tidak bisa
-- diberi klausa WHERE. Efeknya sama kerasnya.
create unique index if not exists tree_plantings_one_active_per_tree
  on public.tree_plantings (tree_id)
  where ended_at is null;

-- 1g -- index pendukung, mengikuti pola tabel lain (mis. idx_trees_farm 006:10).
create index if not exists idx_tree_plantings_farm
  on public.tree_plantings (farm_id);

create index if not exists idx_tree_plantings_tree_cycle
  on public.tree_plantings (tree_id, cycle_no desc);

-- ===========================================================================
-- 2. (1.2) Pindahkan variety dan planted_at
--
-- Tabel trees kosong, jadi tidak ada backfill. Lihat blok VERIFIKASI SEBELUM
-- MEN-DROP di kepala berkas: nol objek database membaca kedua kolom ini.
--
-- Sengaja TANPA cascade. Kalau ternyata masih ada yang bergantung, migrasi ini
-- HARUS gagal keras supaya ketahuan (pelajaran 044:184-190).
-- ===========================================================================

alter table public.trees
  drop column variety,
  drop column planted_at;

comment on table public.trees is
  'Posisi tanam di kebun, bukan identitas sebatang pohon. Apa yang tumbuh di posisi ini dan kapan ditanam hidup di tree_plantings.';

-- ===========================================================================
-- 3. (1.3) RLS dan grant
--
-- Baca: mengikuti pola trees (007:141-146) -- seluruh anggota aktif kebun.
-- Tulis: TIDAK ADA policy sama sekali, dan grant-nya dicabut. Satu-satunya
-- jalur tulis adalah ketiga RPC SECURITY DEFINER di bagian 4, yang berjalan
-- sebagai pemilik tabel dan karenanya melewati RLS.
--
-- Polanya sepadan dengan care_activities setelah migrasi 043:388-389.
-- ===========================================================================

alter table public.tree_plantings enable row level security;

drop policy if exists "Active members can view tree plantings" on public.tree_plantings;

create policy "Active members can view tree plantings"
on public.tree_plantings
for select
to authenticated
using (public.is_active_farm_member(farm_id, auth.uid()));

grant select on public.tree_plantings to authenticated;

revoke insert, update, delete, truncate on public.tree_plantings
  from anon, authenticated;

-- ===========================================================================
-- 4. RPC
--
-- CATATAN LINGKUP -- BACA SEBELUM MENGANDALKAN JAMINAN DI BAWAH.
--
-- create_tree_with_planting menjamin "pohon selalu punya siklus" HANYA untuk
-- pohon yang dibuat lewatnya. Grant INSERT pada public.trees masih menempel di
-- authenticated (007:350) berikut policy "Active owner can insert trees"
-- (007:148-153), jadi owner aktif secara teknis MASIH BISA menyisipkan baris
-- trees telanjang lewat PostgREST -- dan baris itu akan berumur tanpa siklus.
--
-- Tidak dicabut di sini karena berada di luar yang diminta migrasi ini, dan
-- pencabutannya menyentuh policy tabel lain. Sisi aplikasi sudah sepenuhnya
-- pindah ke RPC pada commit yang sama, jadi celahnya tidak terpakai -- tapi ia
-- ADA, dan menutupnya layak jadi bagian migrasi berikutnya.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 4a. (1.4) create_tree_with_planting -- posisi baru + siklus pertamanya
--
-- Satu transaksi, dua baris. Pohon tanpa siklus tanam adalah keadaan yang tidak
-- sah, dan hanya transaksi yang bisa menjaminnya -- itulah sebabnya jalur ini
-- menggantikan INSERT langsung dari aplikasi.
--
-- Rentang posisi terhadap ukuran kebun TIDAK diperiksa di sini: itu sudah milik
-- validate_tree_position_trigger (054), yang berbunyi pada INSERT ke trees di
-- bawah. Mengulangnya berarti dua tempat yang harus dijaga sinkron.
-- ---------------------------------------------------------------------------

create or replace function public.create_tree_with_planting(
  p_farm_id uuid,
  p_row_position smallint,
  p_column_position text,
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
  new_tree_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Hanya pemilik aktif yang dapat menambah pohon.';
  end if;

  insert into public.trees (farm_id, row_position, column_position)
  values (p_farm_id, p_row_position, p_column_position)
  returning id into new_tree_id;

  insert into public.tree_plantings (
    tree_id, farm_id, cycle_no, variety, planted_at, created_by
  )
  values (
    new_tree_id,
    p_farm_id,
    1,
    nullif(btrim(p_variety), ''),
    p_planted_at,
    current_user_id
  );

  return new_tree_id;
end;
$$;

revoke execute on function public.create_tree_with_planting(uuid, smallint, text, text, date)
  from public, anon;

grant execute on function public.create_tree_with_planting(uuid, smallint, text, text, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4b. (1.5) end_tree_planting -- menutup siklus yang sedang berjalan
--
-- SENGAJA TIDAK tertaut ke kondisi pohon. Mencatat kondisi 'mati' tidak
-- memanggil fungsi ini, dan fungsi ini tidak menyentuh trees.current_condition.
-- Lihat alasannya di kepala berkas.
-- ---------------------------------------------------------------------------

create or replace function public.end_tree_planting(
  p_tree_id uuid,
  p_end_reason text,
  p_ended_at date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  tree_farm_id uuid;
  active_planting record;
  final_ended_at date;
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
    raise exception 'Hanya pemilik aktif yang dapat menutup siklus tanam.';
  end if;

  if p_end_reason is null
     or p_end_reason not in ('mati', 'dibongkar', 'diganti') then
    raise exception 'Alasan berakhir harus salah satu dari: mati, dibongkar, diganti.';
  end if;

  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya.
  select id, cycle_no, planted_at
  into active_planting
  from public.tree_plantings
  where tree_id = p_tree_id
    and ended_at is null;

  if active_planting.id is null then
    raise exception 'Posisi ini tidak punya siklus tanam yang berjalan.';
  end if;

  -- Tanggal kosong berarti hari ini. WIB, mengikuti seluruh perhitungan
  -- tanggal di skema ini (mis. 048:331, 049:163).
  final_ended_at := coalesce(p_ended_at, (now() at time zone 'Asia/Jakarta')::date);

  -- Diperiksa di sini supaya pesannya terbaca owner. Constraint
  -- tree_plantings_date_order_check tetap jadi jaring pengaman terakhir.
  if active_planting.planted_at is not null
     and final_ended_at < active_planting.planted_at then
    raise exception
      'Tanggal berakhir (%) tidak boleh mendahului tanggal tanam (%).',
      final_ended_at, active_planting.planted_at;
  end if;

  update public.tree_plantings
  set ended_at = final_ended_at,
      end_reason = p_end_reason,
      ended_by = current_user_id
  where id = active_planting.id;
end;
$$;

revoke execute on function public.end_tree_planting(uuid, text, date)
  from public, anon;

grant execute on function public.end_tree_planting(uuid, text, date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4c. (1.6) start_tree_planting -- menanami ulang posisi yang sudah kosong
--
-- Penjaga "masih ada siklus aktif" ditulis eksplisit walau
-- tree_plantings_one_active_per_tree juga menangkapnya. Alasannya pesan:
-- pelanggaran unique index berbunyi "duplicate key value violates unique
-- constraint" -- tidak memberi tahu owner bahwa yang harus ia lakukan adalah
-- menutup siklus sebelumnya lebih dulu.
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

  return new_planting_id;
end;
$$;

revoke execute on function public.start_tree_planting(uuid, text, date)
  from public, anon;

grant execute on function public.start_tree_planting(uuid, text, date)
  to authenticated;

-- ===========================================================================
-- 5. Muat ulang cache schema PostgREST
--
-- Tabel baru, dua kolom trees hilang, dan tiga RPC baru yang dipanggil klien.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom trees benar-benar hilang -- harus 0 baris:
--
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='trees'
--         and column_name in ('variety','planted_at');
--
-- 2. PENJAGAAN TERPENTING. Partial unique index terpasang -- harus 1 baris,
--    dan definisinya harus memuat WHERE:
--
--      select indexdef from pg_indexes
--       where schemaname='public' and indexname='tree_plantings_one_active_per_tree';
--
--    -> harus berakhir dengan `WHERE (ended_at IS NULL)`. Kalau klausa WHERE
--       tidak ada, index itu SALAH -- ia akan melarang posisi ditanami lebih
--       dari sekali seumur hidup. STOP dan perbaiki sebelum dipakai.
--
-- 3. Ketiga RPC ada, TEPAT SATU signature masing-masing:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public'
--        and p.proname in ('create_tree_with_planting','end_tree_planting',
--                          'start_tree_planting')
--      order by 1;
--
-- 4. Grant tulis benar-benar dicabut -- authenticated hanya boleh SELECT:
--
--      select privilege_type from information_schema.role_table_grants
--       where table_schema='public' and table_name='tree_plantings'
--         and grantee='authenticated';
--
--    -> hanya 'SELECT'. Kalau INSERT/UPDATE/DELETE muncul, jalur tulis di luar
--       RPC masih terbuka.
--
-- 5. Alur siklus penuh, jalankan berurutan sebagai owner aktif:
--
--    a. select public.create_tree_with_planting(
--         '<farm>', 1::smallint, 'A', 'Alpukat Mentega', current_date);
--       -> mengembalikan tree_id. Periksa siklusnya lahir:
--
--          select cycle_no, variety, ended_at from public.tree_plantings
--           where tree_id='<tree>';
--          -> satu baris, cycle_no 1, ended_at NULL.
--
--    b. select public.start_tree_planting('<tree>', 'Miki', current_date);
--       -> HARUS DITOLAK: 'Posisi ini masih ditanami...'
--
--    c. select public.end_tree_planting('<tree>', 'mati', current_date);
--       -> sukses. ended_at, end_reason, ended_by terisi.
--
--    d. select public.end_tree_planting('<tree>', 'mati', current_date);
--       -> HARUS DITOLAK: 'Posisi ini tidak punya siklus tanam yang berjalan.'
--
--    e. select public.start_tree_planting('<tree>', 'Miki', current_date);
--       -> sukses, dan cycle_no siklus barunya HARUS 2:
--
--          select cycle_no, variety, ended_at from public.tree_plantings
--           where tree_id='<tree>' order by cycle_no;
--
--    f. select public.end_tree_planting('<tree>', 'ditebang', current_date);
--       -> HARUS DITOLAK: alasan di luar daftar yang sah.
--
--    g. select public.end_tree_planting('<tree>', 'mati', '2000-01-01');
--       -> HARUS DITOLAK kalau planted_at siklus aktifnya lebih baru.
--
-- 6. Kondisi pohon TIDAK ikut berubah saat siklus ditutup -- ini yang
--    membuktikan keduanya benar-benar terpisah:
--
--      select current_condition from public.trees where id='<tree>';
--
--    -> tetap seperti sebelum end_tree_planting dipanggil (default 'healthy'
--       kalau belum pernah ada catatan kondisi).
--
-- 7. Pohon yang dihapus membawa siklusnya (ON DELETE CASCADE). Tidak bisa diuji
--    lewat aplikasi karena prevent_tree_delete_trigger menolak setiap DELETE ke
--    trees -- itu memang disengaja. Cukup periksa FK-nya ada:
--
--      select conname, confdeltype from pg_constraint
--       where conrelid='public.tree_plantings'::regclass and contype='f';
--
--    -> tree_id -> 'c' (cascade), farm_id -> 'c', ended_by -> 'n' (set null),
--       created_by -> 'r' (restrict).
-- ===========================================================================
