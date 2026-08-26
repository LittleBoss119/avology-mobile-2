-- 057_multi_tree_schedule.sql
--
-- Satu jadwal perawatan untuk BANYAK pohon, dan posisi tanpa siklus tanam aktif
-- rontok dari penjadwalan.
--
-- DUA PERUBAHAN, SATU MIGRASI:
--
--   1. target_type = 'tree' dimaknai ulang sebagai "1 sampai N pohon" lewat
--      tabel jembatan public.care_schedule_trees. TIDAK ADA nilai enum baru:
--      `alter type ... add value` tidak bisa dipakai di transaksi yang sama
--      dengan penambahannya, dan lagi pula 'tree' sudah berarti "pohon" --
--      yang berubah cuma jumlahnya.
--
--   2. Pohon tanpa siklus tanam aktif (tidak ada baris tree_plantings dengan
--      ended_at is null) ditolak masuk jadwal BARU, dan rontok dari jadwal
--      PENERUS dalam rantai berulang.
--
-- PENANDANYA SIKLUS TANAM, BUKAN KONDISI POHON. current_condition = 'dead'
-- TIDAK menghentikan penjadwalan apa pun. Pekerja melaporkan pohon mati dari
-- lapangan; menutup siklusnya adalah keputusan pemilik. Keduanya sengaja
-- terpisah sejak 055 dan migrasi ini tidak menyatukannya.
--
-- JADWAL LAMA ADALAH FAKTA TERSIMPAN. Penyaringan hanya terjadi saat PENULISAN
-- di dalam RPC. Tidak ada filter di view, tidak ada trigger penolak, dan tidak
-- ada satu pun baris care_schedules lama yang berubah maknanya secara surut.
--
-- KENAPA BUKAN TRIGGER untuk jalur ubah jadwal: trigger hanya bisa menolak
-- SELURUH baris, sedangkan yang diinginkan adalah "terima pohon yang sah,
-- laporkan yang ditolak". Trigger juga akan melempar galat mentah persis saat
-- pemilik sedang menyunting. Penyaring untuk jalur ubah ditaruh di pemilih
-- pohon pada pekerjaan UI berikutnya. Lihat UTANG YANG DISENGAJA di bawah.
--
-- PRASYARAT: 050-056 sudah dijalankan dan terverifikasi.
--
-- Yang SENGAJA TIDAK disentuh:
--   * tree_history_view -- ia sudah membaca pohon lewat care_activity_trees
--     sejak 028, jadi jadwal banyak pohon otomatis muncul di riwayat tiap pohon
--     tanpa satu baris pun diubah di sana.
--   * trees.is_archived -- penandanya siklus tanam, bukan arsip.
--   * update_task_realization, rollback_completed_task_activity, dan KELIMA
--     trigger pada care_activities. complete_task tetap menghasilkan TEPAT SATU
--     baris care_activities; lihat bagian 8.
--   * sweep_missed_schedules -- lihat bagian 7, penyaringannya diwarisi.
--   * postpone_task, cancel_care_schedule, stop_care_schedule_repeat,
--     assign_worker_to_care_schedule, cleanup_orphan_recurring_schedule.
--   * care_tasks -- TIDAK ada care_task_trees. Tugas mengambil pohonnya lewat
--     care_schedule_id. Dua tabel jembatan berarti dua tempat yang bisa berbeda
--     isinya, dan tidak ada yang memberi tahu saat keduanya menyimpang.

begin;

-- ===========================================================================
-- 1. Tabel jembatan care_schedule_trees
--
-- Bentuknya menyalin care_activity_trees (025:53-62) sedekat mungkin: kunci
-- primer gabungan, dua foreign key CASCADE, satu index untuk arah balik.
-- Kesamaan itu disengaja -- dua tabel jembatan yang berperilaku sama sebaiknya
-- terbaca sama.
--
-- CASCADE dari care_schedules adalah syarat, bukan pilihan:
-- cleanup_orphan_recurring_schedule (041:181) MENGHAPUS jadwal penerus yang
-- yatim. Tanpa CASCADE, penghapusan itu gagal karena baris jembatan menahannya,
-- dan fungsinya cuma akan `raise warning` -- rantai rusak diam-diam.
--
-- CASCADE dari trees mengikuti care_activity_trees. Praktiknya nyaris tidak
-- pernah berbunyi: prevent_tree_delete_trigger (006:416) melempar exception
-- pada SETIAP DELETE ke trees.
-- ===========================================================================

create table if not exists public.care_schedule_trees (
  schedule_id uuid not null
    references public.care_schedules(id) on delete cascade,
  tree_id uuid not null
    references public.trees(id) on delete cascade,
  constraint care_schedule_trees_pkey primary key (schedule_id, tree_id)
);

-- Arah balik: "jadwal apa saja yang menyasar pohon ini". Arah majunya sudah
-- tertutup primary key.
create index if not exists idx_care_schedule_trees_tree_id
  on public.care_schedule_trees(tree_id);

-- ===========================================================================
-- 2. RLS -- mengikuti pola care_schedules (007:234-259)
--
-- SELECT untuk anggota aktif, INSERT dan DELETE untuk pemilik aktif. Tidak ada
-- UPDATE: baris jembatan hanya punya dua kolom dan keduanya kunci primer, jadi
-- "mengubah" berarti hapus lalu tambah.
--
-- DELETE diberikan sekarang walau BELUM ADA yang memakainya. Alasannya bukan
-- spekulasi: menyunting daftar pohon sebuah jadwal adalah persis "hapus lalu
-- tambah", pekerjaan UI berikutnya membutuhkannya, dan tanpa grant ini
-- pekerjaan itu terpaksa membuat migrasi tersendiri hanya untuk satu baris
-- grant. Wewenangnya tidak melebihi yang sudah dimiliki pemilik: ia sudah bisa
-- meng-UPDATE target_tree_id lewat policy 007:251.
--
-- Riwayat TIDAK ikut terbuka. care_activity_trees -- yang menyimpan pohon apa
-- yang benar-benar dikerjakan -- tetap tanpa grant DELETE (025:77).
--
-- Seluruh RPC di bawah SECURITY DEFINER dan mem-bypass RLS ini. Policy di sini
-- menjaga jalur PostgREST langsung, bukan jalur RPC.
-- ===========================================================================

alter table public.care_schedule_trees enable row level security;

grant select, insert, delete on public.care_schedule_trees to authenticated;

drop policy if exists "Active members can view schedule trees" on public.care_schedule_trees;
create policy "Active members can view schedule trees"
on public.care_schedule_trees
for select
to authenticated
using (
  exists (
    select 1
    from public.care_schedules s
    where s.id = schedule_id
      and public.is_active_farm_member(s.farm_id, auth.uid())
  )
);

drop policy if exists "Active owner can insert schedule trees" on public.care_schedule_trees;
create policy "Active owner can insert schedule trees"
on public.care_schedule_trees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.care_schedules s
    where s.id = schedule_id
      and public.is_active_owner(s.farm_id, auth.uid())
  )
  -- Pohonnya wajib sekebun dengan jadwalnya. Tidak ada constraint yang
  -- mengikat keduanya, dan tautan lintas kebun tidak punya makna apa pun.
  and exists (
    select 1
    from public.trees t
    join public.care_schedules s on s.id = schedule_id
    where t.id = tree_id
      and t.farm_id = s.farm_id
  )
);

drop policy if exists "Active owner can delete schedule trees" on public.care_schedule_trees;
create policy "Active owner can delete schedule trees"
on public.care_schedule_trees
for delete
to authenticated
using (
  exists (
    select 1
    from public.care_schedules s
    where s.id = schedule_id
      and public.is_active_owner(s.farm_id, auth.uid())
  )
);

-- ===========================================================================
-- 3. Kolom bayangan -- ditandai, TIDAK dibuang
--
-- target_tree_id pada KEDUA tabel tetap hidup dan tetap diisi. Alasannya
-- diputuskan sadar, bukan karena lupa:
--
--   a. Jalur ubah jadwal di aplikasi adalah UPDATE tabel LANGSUNG lewat RLS
--      (careScheduleService.ts:531 dan :568), bukan RPC. Klien Supabase dibuat
--      TANPA tipe Database, jadi nama kolom di sana hanyalah string --
--      `tsc --noEmit` TIDAK akan melihat kolom yang hilang. Membuangnya
--      menghasilkan typecheck hijau, tes DB hijau, dan layar jadwal yang pecah
--      di tangan pemilik.
--   b. care_tasks.target_tree_id adalah kolom TERPISAH yang dibaca
--      validate_care_task (053:188). Migrasi ini hanya berwenang atas sisi
--      jadwal; membuang satu sisi sambil menyisakan sisi lain menghasilkan dua
--      sumber kebenaran yang saling bertentangan.
--
-- Karena bayangannya tetap terisi, care_schedules_target_check (047:67) dan
-- validate_care_schedule (046:38) tetap terpenuhi APA ADANYA. Tidak ada satu
-- pun constraint yang direlaksasi di migrasi ini.
-- ===========================================================================

comment on column public.care_schedules.target_tree_id is
  'BAYANGAN, bukan sumber kebenaran. Sejak migrasi 057 daftar pohon sebuah '
  'jadwal ada di public.care_schedule_trees. Kolom ini menyimpan SATU pohon '
  'berkode terkecil dari daftar itu, semata supaya care_schedules_target_check '
  'dan validate_care_schedule() tetap terpenuhi dan layar lama yang masih '
  'membacanya tidak pecah. Jangan dijadikan dasar keputusan apa pun. '
  'Dibuang setelah migrasi 059.';

comment on column public.care_tasks.target_tree_id is
  'BAYANGAN, bukan sumber kebenaran. Sejak migrasi 057 tugas mengambil daftar '
  'pohonnya lewat care_schedule_id ke public.care_schedule_trees. Kolom ini '
  'menyimpan SATU pohon berkode terkecil dari daftar itu, dan tetap dipakai '
  'complete_task sebagai cadangan untuk jadwal lama yang tidak punya baris '
  'jembatan. Dibuang setelah migrasi 059.';

comment on table public.care_schedule_trees is
  'Sumber kebenaran daftar pohon sebuah jadwal perawatan bertarget pohon '
  '(target_type = ''tree''). Satu jadwal boleh menyasar 1 sampai N pohon.';

-- ===========================================================================
-- 4. Backfill -- WAJIB mendahului apa pun yang menyentuh kolom lama
--
-- Setiap baris care_schedules bertarget 'tree' menghasilkan tepat satu baris
-- jembatan. `on conflict do nothing` membuat migrasi ini aman dijalankan ulang
-- di lingkungan lain yang sudah pernah melewatinya sebagian.
--
-- Kolom bayangan SENGAJA TIDAK DISENTUH di sini. Nilai target_tree_id yang ada
-- sekarang sudah memenuhi definisi "satu pohon berkode terkecil" secara
-- trivial -- sebelum migrasi ini satu jadwal hanya bisa punya satu pohon.
-- Menulisinya ulang tidak menambah apa pun dan hanya menambah permukaan yang
-- bisa salah.
--
-- Baris bertarget 'tree' dengan target_tree_id NULL tidak mungkin ada:
-- care_schedules_target_check (047:67) melarangnya. Syarat `is not null` di
-- bawah ada supaya kalaupun ada baris seperti itu, ia LOLOS dari backfill dan
-- pagar di bagian 4b yang menangkapnya -- bukan diam-diam menjadi baris
-- jembatan ber-tree_id NULL yang gagal sebagai pelanggaran NOT NULL tanpa
-- menjelaskan apa pun.
-- ===========================================================================

insert into public.care_schedule_trees (schedule_id, tree_id)
select s.id, s.target_tree_id
from public.care_schedules s
where s.target_type = 'tree'
  and s.target_tree_id is not null
on conflict do nothing;

-- 4b. Pagar jumlah.
--
-- Angka yang dipakai pemilik saat memutuskan migrasi ini (12 baris 'tree', nol
-- bermasalah) adalah potret SEBELUM db push. Kalau ada yang berubah di
-- antaranya -- baris 'tree' baru masuk, atau ada yang targetnya hilang -- yang
-- diinginkan adalah migrasinya BERHENTI, bukan diam-diam melanjutkan dengan
-- data timpang.
do $$
declare
  tree_schedule_count integer;
  bridge_row_count    integer;
begin
  select count(*) into tree_schedule_count
  from public.care_schedules
  where target_type = 'tree';

  select count(*) into bridge_row_count
  from public.care_schedule_trees b
  join public.care_schedules s on s.id = b.schedule_id
  where s.target_type = 'tree';

  if tree_schedule_count <> bridge_row_count then
    raise exception
      'Backfill care_schedule_trees timpang: % jadwal bertarget pohon, tetapi % baris jembatan. Migrasi dihentikan.',
      tree_schedule_count, bridge_row_count;
  end if;

  raise notice 'Backfill care_schedule_trees: % jadwal bertarget pohon terjembatani.',
    bridge_row_count;
end $$;

-- ===========================================================================
-- 5. Penyaring pohon -- satu fungsi, dipakai tiga tempat
--
-- Diangkat jadi fungsi tersendiri karena aturannya harus SAMA PERSIS di
-- create_manual_schedule dan create_successor_schedule. Disalin dua kali, ia
-- akan menyimpang pada perubahan berikutnya dan tidak ada yang memberi tahu.
--
-- URUTANNYA BAGIAN DARI KONTRAK, bukan kerapian: elemen pertama hasilnya
-- adalah "pohon berkode terkecil" yang dipakai mengisi kolom bayangan.
-- Diurutkan menurut (row_position, column_position), BUKAN menurut teks
-- tree_code -- urutan teks menaruh '10-A' sebelum '2-A', yang bukan kode
-- terkecil dalam arti apa pun. `id` jadi pemutus supaya hasilnya deterministik.
--
-- is_archived SENGAJA TIDAK ikut menyaring. Penandanya siklus tanam, itu yang
-- diminta, dan arsip adalah urusan terpisah yang migrasi ini tidak sentuh.
-- Pemilik yang memilih pohon terarsip masih punya siklus aktif akan
-- mendapatkannya di jadwal -- itu pilihannya, bukan kecelakaan.
-- ===========================================================================

create or replace function public.filter_trees_with_active_planting(
  p_farm_id uuid,
  p_tree_ids uuid[]
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(t.id order by t.row_position, t.column_position, t.id),
    '{}'::uuid[]
  )
  from public.trees t
  where t.id = any(coalesce(p_tree_ids, '{}'::uuid[]))
    and t.farm_id = p_farm_id
    and exists (
      select 1
      from public.tree_plantings p
      where p.tree_id = t.id
        and p.ended_at is null
    );
$$;

revoke all on function public.filter_trees_with_active_planting(uuid, uuid[])
  from public, anon;

-- ===========================================================================
-- 6. create_manual_schedule -- menerima N pohon
--
-- SIGNATURE BERUBAH (satu parameter baru di ujung, dan tabel kembalian
-- bertambah tiga kolom), jadi DROP FUNCTION lebih dulu WAJIB. `create or
-- replace` dengan daftar parameter berbeda hanya membuat OVERLOAD baru, lalu
-- PostgREST menghadapi dua kandidat dan bisa memilih yang salah -- persis kelas
-- bug yang ditangani migrasi 024 dan diperingatkan ulang di 043:110 dan 048.
--
-- p_target_tree_ids ditaruh di UJUNG dan p_target_tree_id DIPERTAHANKAN.
-- Keduanya disengaja: seluruh pemanggil yang ada -- aplikasi
-- (careScheduleService.ts:197) dan tujuh stage tes -- memanggil lewat PostgREST
-- dengan argumen BERNAMA dan mengirim p_target_tree_id. Membuang parameter itu
-- akan memecahkan semuanya sekaligus, padahal pekerjaan UI yang mengirim daftar
-- baru datang di prompt berikutnya.
--
-- Tiga kolom kembalian baru bersifat menambah, bukan mengubah: pemanggil yang
-- ada hanya membaca schedule_id dan task_id dari baris pertama.
-- ===========================================================================

drop function if exists public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer, integer, boolean, text
);

create or replace function public.create_manual_schedule(
  p_farm_id uuid,
  p_title text,
  p_category public.care_category,
  p_scheduled_date date,
  p_assigned_worker_id uuid,
  p_target_type public.target_type,
  p_target_tree_id uuid default null,
  p_custom_target_note text default null,
  p_instruction text default null,
  p_requires_photo boolean default false,
  p_repeat_every_days integer default null,
  p_grace_days integer default null,
  p_never_expires boolean default false,
  p_date_basis text default 'jadwal',
  p_target_tree_ids uuid[] default null
)
returns table (
  schedule_id uuid,
  task_id uuid,
  scheduled_tree_ids uuid[],
  rejected_tree_ids uuid[],
  rejected_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id  uuid := auth.uid();
  new_schedule_id  uuid;
  new_task_id      uuid;
  repeat_days      integer;
  final_grace_days integer;
  -- Pohon
  v_requested      uuid[] := '{}'::uuid[];
  v_valid          uuid[] := '{}'::uuid[];
  v_rejected       uuid[] := '{}'::uuid[];
  v_shadow_tree_id uuid;
  v_rejected_codes text;
  v_unknown_count  integer := 0;
  v_message        text;
begin
  if not public.is_active_owner(p_farm_id, current_user_id) then
    raise exception 'Only active owners can create manual schedules';
  end if;

  if not public.is_active_worker(p_farm_id, p_assigned_worker_id) then
    raise exception 'Schedule tasks can only be assigned to active workers';
  end if;

  if p_date_basis is null or p_date_basis not in ('jadwal', 'realisasi') then
    raise exception 'Dasar tanggal harus ''jadwal'' atau ''realisasi''.';
  end if;

  if coalesce(p_never_expires, false) and p_grace_days is not null then
    raise exception 'Pilih salah satu: p_never_expires atau p_grace_days, jangan keduanya.';
  end if;

  if p_grace_days is not null and p_grace_days < 0 then
    raise exception 'Masa toleransi tidak boleh negatif.';
  end if;

  -- Urutan penentuan masa toleransi DIPERTAHANKAN VERBATIM dari 048:501-527.
  if coalesce(p_never_expires, false) then
    final_grace_days := null;
  elsif p_grace_days is not null then
    final_grace_days := p_grace_days;
  else
    final_grace_days := case p_category
      when 'watering' then 2
      when 'spraying' then 5
      when 'fertilizing' then 10
      when 'weeding' then 14
      else null
    end;
  end if;

  repeat_days := nullif(greatest(coalesce(p_repeat_every_days, 0), 0), 0);

  -- Bayangan default: untuk 'farm' dan 'custom' nilainya memang NULL, dan
  -- care_schedules_target_check mewajibkannya begitu.
  v_shadow_tree_id := p_target_tree_id;

  -- -------------------------------------------------------------------------
  -- Penyaringan siklus aktif. HANYA cabang 'tree'.
  -- -------------------------------------------------------------------------
  if p_target_type = 'tree' then
    -- Daftar menang atas nilai tunggal. Nilai tunggal tetap diterima supaya
    -- pemanggil lama jalan tanpa diubah.
    select coalesce(array_agg(distinct x), '{}'::uuid[])
    into v_requested
    from unnest(
      coalesce(
        nullif(p_target_tree_ids, '{}'::uuid[]),
        case when p_target_tree_id is null then '{}'::uuid[] else array[p_target_tree_id] end
      )
    ) as x
    where x is not null;

    if array_length(v_requested, 1) is null then
      raise exception 'Jadwal untuk pohon harus menyebut pohon mana yang dirawat.';
    end if;

    v_valid := public.filter_trees_with_active_planting(p_farm_id, v_requested);

    select coalesce(array_agg(x), '{}'::uuid[])
    into v_rejected
    from unnest(v_requested) as x
    where not (x = any(v_valid));

    -- Tidak ada satu pun yang sah -> gagalkan dengan pesan yang jelas.
    if array_length(v_valid, 1) is null then
      raise exception
        'Tidak ada pohon yang bisa dijadwalkan. Pohon yang dipilih tidak sedang ditanami, atau bukan milik kebun ini.';
    end if;

    -- Sebagian ditolak -> jadwal TETAP dibuat untuk yang sah, dan yang ditolak
    -- dilaporkan balik. Pesannya dikembalikan sebagai data, bukan dilempar
    -- sebagai exception: exception akan membatalkan jadwal yang seharusnya
    -- tetap jadi.
    if array_length(v_rejected, 1) is not null then
      select string_agg(t.tree_code, ', ' order by t.row_position, t.column_position, t.id)
      into v_rejected_codes
      from public.trees t
      where t.id = any(v_rejected)
        and t.farm_id = p_farm_id;

      select array_length(v_rejected, 1) - count(*)
      into v_unknown_count
      from public.trees t
      where t.id = any(v_rejected)
        and t.farm_id = p_farm_id;

      if v_rejected_codes is not null then
        v_message := 'Pohon ' || v_rejected_codes
          || ' tidak sedang ditanami, jadi tidak ikut dijadwalkan.';
      end if;

      if coalesce(v_unknown_count, 0) > 0 then
        v_message := coalesce(v_message || ' ', '')
          || v_unknown_count || ' pohon yang dipilih tidak dikenali di kebun ini.';
      end if;
    end if;

    -- Elemen pertama = pohon berkode terkecil, dijamin urutan di
    -- filter_trees_with_active_planting.
    v_shadow_tree_id := v_valid[1];
  end if;

  new_schedule_id := gen_random_uuid();

  insert into public.care_schedules (
    id, farm_id, title, category, scheduled_date, target_type,
    target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id,
    grace_days, date_basis
  ) values (
    new_schedule_id, p_farm_id, p_title, p_category, p_scheduled_date,
    p_target_type, v_shadow_tree_id,
    p_custom_target_note, p_instruction, coalesce(p_requires_photo, false),
    current_user_id,
    repeat_days,
    case when repeat_days is null then null else new_schedule_id end,
    null,
    final_grace_days, p_date_basis
  );

  -- Jembatan diisi SETELAH jadwalnya ada -- foreign key-nya menuntut itu.
  if p_target_type = 'tree' then
    insert into public.care_schedule_trees (schedule_id, tree_id)
    select new_schedule_id, x
    from unnest(v_valid) as x
    on conflict do nothing;
  end if;

  insert into public.care_tasks (
    farm_id, care_schedule_id, assigned_to, assigned_by, title, category,
    instruction, target_type, target_tree_id,
    custom_target_note, due_date, requires_photo
  ) values (
    p_farm_id, new_schedule_id, p_assigned_worker_id, current_user_id,
    p_title, p_category, p_instruction, p_target_type, v_shadow_tree_id,
    p_custom_target_note, p_scheduled_date, coalesce(p_requires_photo, false)
  )
  returning id into new_task_id;

  return query select new_schedule_id, new_task_id, v_valid, v_rejected, v_message;
end;
$$;

revoke execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer, integer, boolean, text, uuid[]
) from public, anon;

grant execute on function public.create_manual_schedule(
  uuid, text, public.care_category, date, uuid, public.target_type,
  uuid, text, text, boolean, integer, integer, boolean, text, uuid[]
) to authenticated;

-- ===========================================================================
-- 7. create_successor_schedule -- pohon rontok dari PENERUS, bukan dari yang berjalan
--
-- SIGNATURE TIDAK BERUBAH (uuid, timestamptz), jadi `create or replace` sudah
-- cukup dan `revoke all` yang menempel dari 048:253 tetap utuh.
--
-- Seluruh penjaga rantai -- satu-jadwal-terbuka-per-rantai, penjaga idempoten,
-- pemilihan owner aktif, perhitungan tanggal WIB berikut pagar 1000 langkah,
-- dan blok exception penutup -- DIPERTAHANKAN VERBATIM dari 048:90. Yang
-- ditambahkan hanya satu blok resolusi pohon dan pengisian jembatan penerus.
--
-- KENAPA sweep_missed_schedules (051:512) TIDAK ikut ditulis ulang: seluruh
-- penyaringannya ada di sini, dan penyapu memanggil fungsi ini di 5c. Menyalin
-- aturan yang sama ke penyapu berarti dua salinan yang bisa menyimpang. Perilaku
-- yang diminta -- penyapu mengikuti aturan yang sama -- didapat lewat pewarisan,
-- bukan lewat duplikasi.
--
-- RANTAI YANG BERHENTI BUKAN GALAT. Kalau seluruh pohon rontok, fungsi ini
-- `return null` seperti pada setiap penghentian normal lainnya (induk tidak
-- berulang, sudah dibatalkan, penerus sudah ada, tidak ada owner aktif). TIDAK
-- ada exception yang dilempar: penyapu memanggil ini dalam loop dari jalur BACA
-- aplikasi, dan satu exception di sana akan menggagalkan pembacaan daftar
-- jadwal untuk seluruh kebun.
-- ===========================================================================

create or replace function public.create_successor_schedule(
  p_schedule_id uuid,
  p_performed_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent          public.care_schedules%rowtype;
  source_task     public.care_tasks%rowtype;
  chain_series_id uuid;
  active_owner_id uuid;
  next_date       date;
  today_wib       date;
  new_schedule_id uuid;
  step_guard      integer := 0;
  parent_tree_ids uuid[] := '{}'::uuid[];
  surviving_ids   uuid[] := '{}'::uuid[];
  shadow_tree_id  uuid;
begin
  select * into parent
  from public.care_schedules
  where id = p_schedule_id;

  if parent.id is null
     or parent.repeat_every_days is null
     or parent.is_cancelled then
    return null;
  end if;

  chain_series_id := coalesce(parent.series_id, parent.id);

  -- Penjaga satu-jadwal-terbuka-per-rantai (048).
  if exists (
    select 1
    from public.care_schedules s
    left join public.care_tasks t on t.care_schedule_id = s.id
    where s.series_id = chain_series_id
      and s.id <> parent.id
      and s.is_cancelled = false
      and s.missed_at is null
      and (
        t.id is null
        or (t.status <> 'completed' and t.missed_at is null)
      )
  ) then
    return null;
  end if;

  -- Penjaga idempoten (048).
  if exists (
    select 1 from public.care_schedules
    where parent_schedule_id = parent.id
  ) then
    return null;
  end if;

  -- -------------------------------------------------------------------------
  -- BARU: pohon mana yang masih layak dirawat di siklus BERIKUTNYA.
  --
  -- Jadwal induk TIDAK disentuh. Pohon yang siklusnya ditutup di tengah rantai
  -- tetap tercatat sebagai target jadwal yang sedang berjalan -- itu fakta yang
  -- sudah terjadi -- dan hanya tidak ikut ke penerusnya.
  -- -------------------------------------------------------------------------
  if parent.target_type = 'tree' then
    select coalesce(array_agg(cst.tree_id), '{}'::uuid[])
    into parent_tree_ids
    from public.care_schedule_trees cst
    where cst.schedule_id = parent.id;

    -- Jadwal lama yang luput backfill: jatuh balik ke kolom bayangan supaya
    -- rantainya tidak berhenti karena alasan administratif.
    if array_length(parent_tree_ids, 1) is null then
      parent_tree_ids := case
        when parent.target_tree_id is null then '{}'::uuid[]
        else array[parent.target_tree_id]
      end;
    end if;

    surviving_ids := public.filter_trees_with_active_planting(
      parent.farm_id, parent_tree_ids
    );

    -- Seluruh pohon rontok -> rantai berhenti bersih. Bukan galat.
    if array_length(surviving_ids, 1) is null then
      return null;
    end if;

    shadow_tree_id := surviving_ids[1];
  else
    shadow_tree_id := parent.target_tree_id;
  end if;

  -- Owner aktif untuk created_by / assigned_by (048).
  select fm.user_id into active_owner_id
  from public.farm_members fm
  where fm.farm_id = parent.farm_id
    and fm.role = 'owner'
    and fm.status = 'active'
  order by (fm.user_id = parent.created_by) desc, fm.user_id
  limit 1;

  if active_owner_id is null then
    return null;
  end if;

  today_wib := (now() at time zone 'Asia/Jakarta')::date;

  if parent.date_basis = 'realisasi' and p_performed_at is not null then
    next_date := (p_performed_at at time zone 'Asia/Jakarta')::date
                 + parent.repeat_every_days;
  else
    next_date := parent.scheduled_date + parent.repeat_every_days;

    while next_date <= today_wib and step_guard < 1000 loop
      next_date := next_date + parent.repeat_every_days;
      step_guard := step_guard + 1;
    end loop;
  end if;

  -- grace_days dan date_basis diwariskan; missed_at TIDAK.
  insert into public.care_schedules (
    farm_id, title, category, scheduled_date,
    target_type, target_tree_id, custom_target_note,
    instruction, requires_photo, created_by,
    repeat_every_days, series_id, parent_schedule_id,
    grace_days, date_basis
  ) values (
    parent.farm_id, parent.title, parent.category, next_date,
    parent.target_type, shadow_tree_id, parent.custom_target_note,
    parent.instruction, parent.requires_photo, active_owner_id,
    parent.repeat_every_days, chain_series_id, parent.id,
    parent.grace_days, parent.date_basis
  )
  returning id into new_schedule_id;

  if parent.target_type = 'tree' then
    insert into public.care_schedule_trees (schedule_id, tree_id)
    select new_schedule_id, x
    from unnest(surviving_ids) as x
    on conflict do nothing;
  end if;

  select * into source_task
  from public.care_tasks
  where care_schedule_id = parent.id
  order by created_at
  limit 1;

  if source_task.id is not null
     and public.is_active_worker(parent.farm_id, source_task.assigned_to) then
    insert into public.care_tasks (
      farm_id, care_schedule_id, assigned_to, assigned_by,
      title, category, instruction,
      target_type, target_tree_id,
      custom_target_note, due_date, requires_photo
    ) values (
      parent.farm_id, new_schedule_id, source_task.assigned_to, active_owner_id,
      parent.title, parent.category, parent.instruction,
      parent.target_type, shadow_tree_id,
      parent.custom_target_note, next_date, parent.requires_photo
    );
  end if;

  return new_schedule_id;

exception
  when others then
    raise warning 'Rantai jadwal gagal untuk jadwal %: %', p_schedule_id, sqlerrm;
    return null;
end;
$$;

revoke all on function public.create_successor_schedule(uuid, timestamptz)
  from public, anon;

-- ===========================================================================
-- 8. complete_task -- N pohon, TETAP SATU baris care_activities
--
-- SIGNATURE TIDAK BERUBAH, jadi `create or replace` dan TIDAK ADA DROP
-- FUNCTION: drop akan ikut membuang grant execute yang menempel (pelajaran
-- 043:220), dan tanpa itu pekerja kena "permission denied".
--
-- SATU BARIS care_activities. Ini bukan penyederhanaan -- ini syarat. Tiga hal
-- mengasumsikan tepat satu baris 'completed' per tugas:
--   * update_task_realization (049:251) hanya mengizinkan koreksi pada baris
--     `order by performed_at desc, id desc limit 1`. Dengan N baris berwaktu
--     identik, N-1 di antaranya beku selamanya.
--   * rollback_completed_task_activity (044:122) menghapus SATU baris lalu
--     memulihkan status tugas dari baris terbaru berikutnya. Dengan N baris,
--     membatalkan sekali tidak mengubah apa pun yang terlihat pekerja.
--   * zz_create_next_recurring_schedule_trigger berbunyi PER BARIS.
--
-- Riwayat per pohon TIDAK butuh N aktivitas: tree_history_view mengambil pohon
-- lewat care_activity_trees, dan cabang 'farm' sudah menautkan N pohon ke satu
-- aktivitas sejak 050. Yang berubah di sini hanya SUMBER daftar pohon untuk
-- cabang 'tree'.
--
-- Seluruh verifikasi, pesan galat, penjaga anti-selesai-ganda, validasi
-- pasangan bahan, daftar kolom INSERT, dan cabang 'farm' DIPERTAHANKAN VERBATIM
-- dari 050:82.
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
  task_schedule_id uuid;
  clean_note text := nullif(trim(p_note), '');
  clean_produk text := nullif(trim(p_produk), '');
  clean_satuan text := nullif(trim(p_produk_satuan), '');
  new_activity_id uuid;
  bridge_tree_count integer := 0;
  linked_tree_count integer := 0;
begin
  -- care_schedule_id ikut diambil di sini: ia jalan menuju daftar pohon.
  select farm_id, assigned_to, status, target_type, target_tree_id, care_schedule_id
  into task_farm_id, task_assigned_to, task_current_status,
       task_target_type, task_target_tree_id, task_schedule_id
  from public.care_tasks
  where id = p_task_id;

  if task_farm_id is null then
    raise exception 'Task not found';
  end if;

  if task_assigned_to is distinct from current_user_id then
    raise exception 'Only the assigned worker can complete this task';
  end if;

  if not public.is_active_worker(task_farm_id, current_user_id) then
    raise exception 'Only active workers can complete tasks';
  end if;

  if task_current_status = 'completed' then
    raise exception 'Tugas ini sudah selesai dan tidak bisa dicatat ulang.';
  end if;

  if (p_produk_jumlah is not null or clean_satuan is not null)
     and clean_produk is null then
    raise exception 'Nama bahan wajib diisi kalau takaran diisi.';
  end if;

  if (p_produk_jumlah is null) <> (clean_satuan is null) then
    raise exception 'Takaran dan satuan harus diisi berdua.';
  end if;

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

  if task_target_type = 'tree' then
    select count(*) into bridge_tree_count
    from public.care_schedule_trees
    where schedule_id = task_schedule_id;

    if bridge_tree_count > 0 then
      -- Jalur utama sejak 057: daftar pohon diambil dari jembatan lewat
      -- jadwalnya. Syarat tr.farm_id = task_farm_id menggantikan pemeriksaan
      -- "kebun yang sama" yang di 050 ditulis terpisah -- di sini ia ADALAH
      -- sumber daftarnya, sama seperti cabang 'farm'.
      insert into public.care_activity_trees (care_activity_id, tree_id)
      select distinct new_activity_id, cst.tree_id
      from public.care_schedule_trees cst
      join public.trees tr on tr.id = cst.tree_id
      where cst.schedule_id = task_schedule_id
        and tr.farm_id = task_farm_id;

      get diagnostics linked_tree_count = row_count;

      -- Jembatan punya isi tapi tidak satu pun sekebun dengan tugasnya. Itu
      -- bukan "jadwal lama tanpa jembatan", itu data rusak. Gagal keras:
      -- care_activity_trees sengaja tanpa jalur DELETE (025:67), jadi tautan
      -- salah tidak bisa dikoreksi setelah masuk.
      if linked_tree_count = 0 then
        raise exception 'Semua pohon harus berada di kebun yang sama';
      end if;
    else
      -- Cadangan untuk jadwal lama yang luput backfill, atau tugas yang
      -- jembatannya dikosongkan. Penyelesaian tugas TIDAK boleh gagal hanya
      -- karena baris jembatannya tidak ada -- pekerjaannya sungguh dilakukan.
      -- Isi blok ini VERBATIM dari 050:191-215.
      if task_target_tree_id is null then
        raise exception 'Tugas ini bertarget pohon tetapi tidak menyebut pohon mana.';
      end if;

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
    end if;

  elsif task_target_type = 'farm' then
    -- VERBATIM dari 050:217-231.
    insert into public.care_activity_trees (care_activity_id, tree_id)
    select distinct new_activity_id, tr.id
    from public.trees tr
    where tr.farm_id = task_farm_id
      and tr.is_archived = false;
  end if;

  return new_activity_id;
end;
$function$;

-- Grant SENGAJA tidak ditulis ulang: tidak ada DROP FUNCTION di bagian ini,
-- sehingga grant execute untuk `authenticated` dari 043:227 tetap menempel.

-- ===========================================================================
-- 9. Muat ulang cache schema PostgREST
--
-- Tabel baru yang dibaca klien, satu RPC baru, dan signature
-- create_manual_schedule berubah. Tanpa ini klien kena PGRST202/PGRST205.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- UTANG YANG DISENGAJA -- dibereskan di prompt UI berikutnya, bukan di sini
--
-- 1. JALUR UBAH JADWAL BISA MEMBUAT BAYANGAN MENYIMPANG DARI JEMBATAN.
--    careScheduleService.ts:531 dan :568 meng-UPDATE target_tree_id LANGSUNG
--    lewat RLS, bukan lewat RPC. Pemilik yang menyunting jadwal bertarget pohon
--    akan mengubah bayangannya tanpa menyentuh care_schedule_trees sama sekali.
--    Akibatnya: complete_task tetap memakai daftar dari JEMBATAN (yang lama),
--    sementara layar menampilkan bayangan (yang baru).
--
--    TIDAK ditambal lewat trigger -- lihat alasannya di kepala berkas.
--    Penyelesaiannya: pemilih pohon di layar edit menulis ke jembatan.
--
-- 2. JALUR UBAH JADWAL TIDAK MENYARING SIKLUS AKTIF. Pemilik masih bisa
--    menyunting jadwal agar menyasar posisi yang siklusnya sudah ditutup.
--    Penyaringnya ditaruh di pemilih pohon.
--
-- 3. assign_worker_to_care_schedule (051:314) menyalin target_tree_id bayangan
--    ke tugas baru. Itu BENAR dan tidak perlu diubah -- tugas mengambil daftar
--    pohonnya lewat care_schedule_id, bukan lewat kolom itu.
--
-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Tabel jembatan ada, dengan kunci dan index yang benar:
--
--      select indexname from pg_indexes
--      where tablename = 'care_schedule_trees';
--    -> harus memuat care_schedule_trees_pkey dan
--       idx_care_schedule_trees_tree_id.
--
-- 2. BACKFILL LENGKAP -- kedua angka harus SAMA:
--
--      select
--        (select count(*) from public.care_schedules where target_type = 'tree') as jadwal_pohon,
--        (select count(*) from public.care_schedule_trees b
--           join public.care_schedules s on s.id = b.schedule_id
--          where s.target_type = 'tree') as baris_jembatan;
--
--    -> kalau berbeda, pagar di bagian 4b seharusnya sudah menggagalkan
--       migrasi. Kalau tetap berbeda di sini, STOP dan laporkan.
--
-- 3. create_manual_schedule TIDAK ter-overload -- harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'create_manual_schedule';
--
--    -> kalau muncul dua baris, drop-nya gagal dan PostgREST bisa memilih
--       signature lama. STOP.
--
-- 4. complete_task TIDAK ter-overload dan signature-nya TIDAK berubah:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'complete_task';
--    -> harus tepat satu: complete_task(uuid, text, text, numeric, text)
--
-- 5. Grant execute masih menempel pada complete_task (tidak ada DROP di 8):
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name in ('complete_task', 'create_manual_schedule');
--    -> `authenticated` wajib muncul untuk KEDUANYA.
--
-- 6. Tidak ada nilai enum baru:
--
--      select enumlabel from pg_enum e
--      join pg_type t on t.oid = e.enumtypid
--      where t.typname = 'target_type' order by e.enumsortorder;
--    -> harus tetap: farm, row, column, tree, custom.
--
-- 7. Komentar kolom bayangan terpasang, supaya sesi berikutnya membacanya:
--
--      select col_description('public.care_schedules'::regclass,
--        (select attnum from pg_attribute
--          where attrelid = 'public.care_schedules'::regclass
--            and attname = 'target_tree_id'));
--
-- 8. ALUR NYATA, bukan hanya katalog -- ini inti migrasinya:
--    a. Buat jadwal bertarget TIGA pohon lewat
--       create_manual_schedule(..., p_target_type := 'tree',
--       p_target_tree_ids := array[...]). Periksa care_schedule_trees punya
--       tiga baris, dan care_schedules.target_tree_id terisi pohon berkode
--       terkecil dari ketiganya.
--    b. Selesaikan tugasnya sebagai pekerja. Periksa:
--         select count(*) from care_activities where care_task_id = '<task>';
--       -> HARUS 1.
--         select count(*) from care_activity_trees where care_activity_id = '<act>';
--       -> HARUS 3.
--    c. Tutup siklus salah satu pohon lewat end_tree_planting, lalu selesaikan
--       siklus jadwal berikutnya. Penerusnya harus lahir dengan DUA pohon.
--    d. Tutup siklus dua sisanya. Penerus berikutnya TIDAK BOLEH lahir, dan
--       penyelesaian tugas tetap berhasil tanpa galat.
--       create_successor_schedule menelan exception-nya sendiri, jadi rantai
--       yang rusak TIDAK muncul sebagai error di aplikasi. Cek log Postgres
--       untuk 'Rantai jadwal gagal untuk jadwal'.
-- ===========================================================================
