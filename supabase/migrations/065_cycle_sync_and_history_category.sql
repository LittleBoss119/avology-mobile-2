-- ===========================================================================
-- 065 -- Trigger siklus, reset kondisi, kategori perawatan di riwayat
--
-- Tiga hal yang dikerjakan berkas ini, dan satu benang yang menyatukan dua di
-- antaranya: sebuah posisi tanam yang berganti pohon harus berhenti membawa
-- keadaan pohon sebelumnya.
--
--   1. SATU TRIGGER pada tree_plantings menggantikan perform manual yang 064
--      tanam di dalam start_tree_planting. Trigger menutup KEEMPAT penulis
--      jendela siklus; perform manual hanya menutup satu.
--   2. recalculate_tree_current_condition ikut disaring ke siklus aktif,
--      bentuknya identik dengan yang 064 lakukan untuk fase.
--   3. tree_history_view mendapat kolom `kategori`, supaya kategori perawatan
--      inisiatif tidak lagi hilang begitu pekerja menulis catatan.
--
-- Bagian 1 dan 2 melanjutkan 064 secara langsung. Bagian 3 berdiri sendiri dan
-- tidak menyentuh satu pun fungsi di atas.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Trigger pada tree_plantings
--
-- KENAPA TRIGGER, BUKAN perform DI DALAM RPC.
--
-- 064 memasang `perform recalculate_tree_current_growth_phase(p_tree_id)` di
-- dalam start_tree_planting. Itu benar tapi tidak lengkap: ada EMPAT penulis
-- yang menggeser jendela siklus sebuah posisi, dan hanya satu yang tertutup.
--
--   create_tree_with_planting (055:4a)  INSERT siklus pertama
--   start_tree_planting       (055:4c)  INSERT siklus berikutnya
--   end_tree_planting         (055:4b)  UPDATE ended_at  -> siklus aktif hilang
--   update_tree_with_planting (056)     UPDATE planted_at -> ambang bergeser
--
-- Sesudah end_tree_planting, fungsi recalculate akan menjawab NULL kalau
-- dipanggil -- tapi tidak ada yang memanggilnya, jadi trees.current_growth_phase
-- tetap memegang fase pohon yang baru saja dinyatakan tidak ada. Menambal itu
-- dengan perform kedua dan ketiga berarti tiga tempat yang harus diingat setiap
-- kali penulis kelima lahir. Trigger adalah satu tempat yang tidak bisa dilupa.
--
-- Bentuknya menyalin sync_tree_current_growth_phase_trigger (023:202-209 +
-- 006:524-528) yang sudah lama terpasang pada growth_phase_records: fungsi
-- trigger tipis yang tidak melakukan apa pun selain memanggil recalculate.
--
--
-- `update of planted_at, ended_at` -- BUKAN `update` polos.
--
-- Hanya kedua kolom itu yang menentukan jendela siklus. variety, end_reason,
-- dan ended_by tidak, dan menyalakan trigger untuk mereka berarti dua UPDATE
-- pada trees setiap kali varietas dikoreksi. Diperiksa bahwa kedua penulis
-- UPDATE benar-benar menyebut kolomnya di SET:
--
--   end_tree_planting        -> set ended_at = ..., end_reason = ..., ended_by = ...   (055:331)
--   update_tree_with_planting -> set variety = ..., planted_at = ...                   (056:169)
--
-- Catatan perilaku: `update of` berbunyi ketika kolomnya MUNCUL di SET, bukan
-- ketika nilainya benar-benar berubah. Itu justru yang diinginkan di sini --
-- update_tree_with_planting selalu menulis planted_at, termasuk saat nilainya
-- sama, dan menghitung ulang keadaan yang sudah benar tidak merugikan.
--
--
-- DELETE -- SENGAJA TIDAK DITANGANI. Diperiksa, bukan diasumsikan:
--
--   * Tidak satu pun RPC menghapus baris tree_plantings. Keempat penulis di
--     atas hanya INSERT dan UPDATE.
--   * Hak DELETE dicabut dari anon dan authenticated (055:179-180) dan tidak
--     ada policy DELETE sama sekali (055:169-175 hanya SELECT), jadi tidak ada
--     jalur klien.
--   * Satu-satunya jalur yang tersisa adalah CASCADE: tree_id dan farm_id
--     keduanya `on delete cascade` (055:70-71). Tapi pada kedua jalur itu baris
--     trees induknya IKUT terhapus -- menghitung ulang current_condition dan
--     current_growth_phase untuk baris yang sedang dihapus dalam pernyataan yang
--     sama tidak ada gunanya, dan UPDATE-nya bisa berlomba dengan penghapusannya.
--     Menghapus trees sendiri pun sudah ditolak prevent_tree_delete_trigger
--     (006:416-420) di luar migrasi yang sengaja melumpuhkannya.
--
-- Jadi AFTER DELETE tidak punya satu pun kasus nyata yang ia layani, dan
-- memasangnya justru menambah satu jalur yang berjalan tepat di saat baris
-- induknya sedang dibongkar. Yang tersisa hanya pembedahan manual lewat SQL
-- editor sebagai superuser; itu di luar kontrak trigger mana pun, dan backfill
-- di bagian 4 adalah alat yang benar sesudahnya.
-- ---------------------------------------------------------------------------

create or replace function public.sync_tree_cycle_current_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Kondisi LEBIH DULU, lalu fase. Urutannya tidak berpengaruh pada hasil --
  -- keduanya menulis kolom yang berbeda pada baris yang sama -- dan ditulis
  -- begini semata mengikuti urutan kolomnya di tabel trees (003:9-10).
  perform public.recalculate_tree_current_condition(new.tree_id);
  perform public.recalculate_tree_current_growth_phase(new.tree_id);
  return new;
end;
$$;

drop trigger if exists sync_tree_cycle_current_state_trigger on public.tree_plantings;

create trigger sync_tree_cycle_current_state_trigger
after insert or update of planted_at, ended_at on public.tree_plantings
for each row
execute function public.sync_tree_cycle_current_state();

-- sync_tree_cycle_current_state TIDAK di-revoke, mengikuti sync_tree_current_condition
-- dan sync_tree_current_growth_phase (023:190-211) yang juga tidak pernah
-- di-revoke: fungsi trigger tidak bisa dipanggil bermakna tanpa konteks trigger,
-- jadi tidak ada permukaan yang perlu ditutup. Yang benar-benar dijaga adalah
-- kedua recalculate_* di baliknya, dan keduanya sudah tertutup (023:700-701,
-- ditegaskan ulang 064).


-- ---------------------------------------------------------------------------
-- 1b. start_tree_planting -- perform manual dari 064 DICABUT
--
-- Badannya kembali PERSIS ke 055:354-416. Satu-satunya perbedaan dari berkas
-- 064 adalah hilangnya baris `perform recalculate_tree_current_growth_phase`;
-- tidak ada baris lain yang bergeser.
--
-- Dicabut, bukan dibiarkan berdampingan dengan trigger. Kalau keduanya berdiri,
-- INSERT dari fungsi ini menghitung ulang DUA KALI -- sekali oleh trigger,
-- sekali oleh perform -- dan lebih buruk dari pemborosannya: pembaca berikutnya
-- melihat dua sumber kebenaran dan tidak tahu yang mana yang mengikat. Trigger
-- sudah menutup jalur INSERT ini, jadi perilakunya tidak berubah sedikit pun.
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


-- ---------------------------------------------------------------------------
-- 2. recalculate_tree_current_condition -- disaring ke siklus aktif
--
-- MASALAHNYA sepadan dengan fase, dan akibatnya lebih tajam: fungsi ini
-- (023:138-162) menyaring tree_id dan is_deleted saja, jadi posisi yang
-- ditanami ulang mewarisi kondisi pohon sebelumnya. Pohon ditandai `dead` lewat
-- catatan kondisi, posisinya ditanami ulang, dan bibit barunya menyandang
-- kondisi "Mati" di daftar pohon maupun peta denah.
--
-- Migrasi 055:262-265 dan 055:506-508 menyatakan kondisi memang TIDAK direset
-- saat siklus ditutup atau dimulai. Berkas ini membalikkan keputusan itu atas
-- persetujuan eksplisit; catatan lama di 055 dibiarkan sebagai jejak sejarah,
-- tidak diubah.
--
-- BENTUK PENYARINGNYA IDENTIK dengan 064 bagian 1, disengaja sampai ke tanda
-- kurungnya. Alasan setiap bagiannya sudah ditulis panjang di sana dan tidak
-- diulang di sini; ringkasnya:
--
--   * (reported_at at time zone 'Asia/Jakarta')::date -- arah cast timestamptz
--     ke date WIB, BUKAN sebaliknya. Membiarkannya implisit membuat "tanggal
--     tanam" berarti tengah malam UTC alias 07.00 WIB, dan catatan pagi hari
--     penanaman jatuh sebelum ambangnya. Idiom yang sama dipakai 041:112,
--     046:238, 047:504, 048:184, 057:669.
--   * coalesce(planted_at, created_at WIB) -- planted_at boleh NULL (055:74,
--     start_tree_planting menerimanya default null di 055:357). Cadangan
--     created_at sepadan dengan cycleStartKey() di src/utils/treeCycle.ts:183.
--
-- TIPE KOLOM diperiksa langsung, sama seperti 064:
--   tree_plantings.planted_at            -> date        (055:74, nullable)
--   tree_condition_reports.reported_at   -> timestamptz (003:25, not null)
--
--
-- YANG BERBEDA DARI FASE, DAN SENGAJA DIPERTAHANKAN:
--
-- coalesce(latest_condition, 'healthy') di UPDATE penutup TIDAK disentuh. Ia
-- bukan pilihan gaya melainkan keharusan: trees.current_condition adalah
-- `not null default 'healthy'` (003:9), jadi menulis NULL ke sana akan
-- melanggar constraint dan menggagalkan setiap penanaman ulang.
--
-- Akibatnya sepadan dengan yang diinginkan: pohon baru tanpa catatan kondisi
-- berangkat dari 'healthy', bukan dari kondisi pohon sebelumnya. Posisi KOSONG
-- (tanpa siklus aktif) juga jatuh ke 'healthy' -- nilai itu tidak terlihat di
-- mana pun, karena layar detail posisi kosong menampilkan tag "Belum ditanami"
-- alih-alih tag kondisi.
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
  active_start date;
begin
  -- Tunggal karena tree_plantings_one_active_per_tree menjaminnya (055:1f).
  select coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
  into active_start
  from public.tree_plantings tp
  where tp.tree_id = p_tree_id
    and tp.ended_at is null;

  -- Posisi kosong: tidak ada pohon yang bisa punya kondisi. Select di bawah
  -- SENGAJA dilewati alih-alih dibiarkan berjalan dengan ambang NULL -- hasilnya
  -- sama, tapi niatnya jadi terbaca dan tidak bergantung pada perilaku NULL.
  if active_start is not null then
    select condition_status
    into latest_condition
    from public.tree_condition_reports
    where tree_id = p_tree_id
      and is_deleted = false
      and (reported_at at time zone 'Asia/Jakarta')::date >= active_start
    order by reported_at desc, created_at desc, id desc
    limit 1;
  end if;

  update public.trees
  set current_condition = coalesce(latest_condition, 'healthy'::public.tree_condition_status),
      updated_at = now()
  where id = p_tree_id;
end;
$$;

-- Ditegaskan ulang, sepadan dengan 023:700. `create or replace function`
-- mempertahankan grant yang ada, jadi ini penegasan bukan perbaikan: fungsi ini
-- tidak pernah dipanggil langsung dari klien.
revoke execute on function public.recalculate_tree_current_condition(uuid)
  from public, anon;


-- ---------------------------------------------------------------------------
-- 3. tree_history_view -- kolom `kategori`
--
-- MASALAHNYA. Cabang perawatan merakit description sebagai
--
--     coalesce(nullif(trim(ca.note), ''), ca.category::text)
--
-- yaitu SALAH SATU, bukan keduanya. Begitu pekerja menulis catatan, kategori
-- perawatannya tidak ikut terbawa sama sekali dan tidak ada cara mengambilnya
-- dari sisi klien -- baris riwayat kehilangan satu-satunya keterangan yang
-- membedakan penyiraman dari pemupukan.
--
-- description SENGAJA TIDAK DIUBAH. Layar detail catatan masih membacanya, dan
-- mengubah bentuknya akan menggeser layar itu tanpa diminta. Kategori datang
-- sebagai kolom BARU di sampingnya, bukan sebagai perubahan kolom lama.
--
--
-- NAMANYA `kategori`, bahasa Indonesia, mengikuti `asal` dan `produk` yang
-- sudah lebih dulu ada di view ini (028, 032). Ketiganya kolom yang hanya
-- terisi pada cabang perawatan, dan ketiganya kini bernama sama seperti kolom
-- asalnya di care_activities.
--
--
-- `::text`, BUKAN enum mentah. care_activities.category bertipe
-- public.care_category (025:16), sedangkan tiga cabang lain harus mengisinya
-- dengan NULL. UNION ALL menuntut tipe yang cocok di seluruh cabang, dan
-- `care_category` lawan `null::text` tidak bisa dicocokkan Postgres sendiri.
-- Cast ke text adalah pola yang sudah dipakai view ini di dua tempat lain --
-- tcr.condition_status::text dan gpr.phase::text pada kolom title -- jadi klien
-- memang sudah terbiasa menerima enum sebagai string mentah dan menerjemahkannya
-- sendiri (isCareCategory/formatCareCategory di sisi React).
--
--
-- TIDAK PERLU DROP, dan itu diperiksa bukan diasumsikan. `create or replace
-- view` menolak perubahan pada kolom yang sudah ada tetapi MENGIZINKAN kolom
-- baru ditambahkan di UJUNG daftar. Sepuluh kolom lama (source_id, tree_id,
-- farm_id, history_type, title, description, actor_id, happened_at, asal,
-- produk) disalin apa adanya dari 045:241-321 dengan nama, urutan, dan tipe
-- yang sama persis; `kategori` menyusul sesudah `produk`.
--
-- Menghindari DROP itu penting, bukan sekadar rapi: view ini dibuat dengan
-- `with (security_invoker = true)` (028:26-27) dan diberi `grant select ... to
-- authenticated` (028:103). `create or replace` mempertahankan keduanya;
-- `drop` lalu `create` akan membuang keduanya diam-diam kecuali keduanya
-- ditulis ulang -- dan security_invoker yang hilang berarti view berjalan
-- sebagai pemiliknya, melewati RLS. Itu kebocoran data lintas kebun.
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
    null::text as kategori
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
    null::text as kategori
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
    ca.category::text as kategori
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
    null::text as kategori
   from harvest_records hr
  where hr.is_deleted = false;

comment on view public.tree_history_view is
  'Riwayat satu pohon dari empat tabel catatan. Kolom kategori (065) hanya terisi pada cabang perawatan; ia melengkapi description, yang pada cabang itu berisi catatan ATAU kategori, tidak keduanya.';


-- ---------------------------------------------------------------------------
-- 4. Backfill
--
-- Kondisi DAN fase dihitung ulang untuk seluruh baris trees. Fase ikut walau
-- 064 sudah pernah membetulkannya: sejak itu tidak ada trigger yang memanggil
-- recalculate saat siklus DITUTUP, jadi setiap end_tree_planting antara push
-- 064 dan push berkas ini meninggalkan fase basi. Menghitung ulang keduanya
-- sekaligus lebih murah daripada menalar baris mana yang terlewat.
--
-- Lewat perform kedua fungsi, bukan satu UPDATE ... FROM yang mengulang
-- logikanya. Alasannya sama seperti 064: satu tempat yang memutuskan.
--
--
-- PERINGATAN 064 MASIH BERLAKU. validate_tree_position_trigger (054:306-310)
-- berbunyi pada SETIAP update ke trees, bukan hanya saat posisinya berubah. Ia
-- membandingkan row_position/column_position dengan grid_rows/grid_columns
-- kebunnya dan melempar exception kalau lewat batas. Loop di bawah menulis ke
-- SELURUH baris trees, jadi satu baris di luar batas membatalkan migrasi ini.
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
-- YANG AKAN BERUBAH SETELAH INI DIJALANKAN:
--
--   * Posisi yang ditanami ulang -> kondisi lepas dari pohon lama. Bibit di
--     posisi bekas pohon mati berhenti berbunyi "Mati" dan kembali "Sehat".
--   * Posisi tanpa siklus aktif -> kondisi jadi 'healthy'. Tidak terlihat di
--     mana pun: layar detail posisi kosong menampilkan "Belum ditanami".
--   * Catatan kondisi yang tanggalnya MENDAHULUI tanggal tanam siklus aktif
--     berhenti dihitung, termasuk pada posisi yang baru sekali ditanami.
--   * Peta denah dan daftar pohon ikut berubah warnanya untuk pohon-pohon itu.
--     Itu perbaikannya, bukan kehilangan.
--
-- EFEK SAMPING YANG DISADARI, sama seperti 064: kedua fungsi selalu menulis
-- updated_at = now(), jadi backfill ini menggeser trees.updated_at untuk setiap
-- baris. Diperiksa -- tidak ada layar yang menampilkan atau mengurutkan
-- berdasarkan kolom itu, dan tidak ada trigger yang bergantung padanya.
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
-- 5. Muat ulang cache schema PostgREST
--
-- WAJIB di berkas ini, bukan sekadar kebiasaan: tree_history_view bertambah
-- kolom, dan PostgREST menolak kolom yang belum dikenal cache-nya. Tanpa reload,
-- select pertama yang menyebut `kategori` akan gagal.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';


-- ===========================================================================
-- VERIFIKASI MANUAL (jalankan sesudah push; tidak dijalankan otomatis)
--
-- 1. Trigger terpasang pada kolom yang benar:
--
--      select t.tgname,
--             pg_get_triggerdef(t.oid) as definisi
--      from pg_trigger t
--      join pg_class c on c.oid = t.tgrelid
--      where c.relname = 'tree_plantings' and not t.tgisinternal;
--
--    -> satu baris sync_tree_cycle_current_state_trigger, definisinya menyebut
--       AFTER INSERT OR UPDATE OF planted_at, ended_at.
--
-- 2. start_tree_planting sudah bersih dari perform 064:
--
--      select prosrc from pg_proc
--      where proname = 'start_tree_planting';
--
--    -> tidak mengandung 'recalculate_tree_current_growth_phase'.
--
-- 3. Menutup siklus mereset KEDUA kolom. Pada satu posisi uji yang kondisinya
--    bukan 'healthy' dan fasenya terisi:
--
--      select public.end_tree_planting('<tree>', 'mati', current_date);
--      select current_condition, current_growth_phase
--      from public.trees where id = '<tree>';
--
--    -> 'healthy' dan NULL.
--
-- 4. Menanam ulang tetap bersih:
--
--      select public.start_tree_planting('<tree>', 'Miki', current_date);
--      select current_condition, current_growth_phase
--      from public.trees where id = '<tree>';
--
--    -> 'healthy' dan NULL.
--
-- 5. Tidak ada pohon yang kondisinya berasal dari catatan sebelum tanggal tanam
--    siklus aktifnya:
--
--      select t.id, t.tree_code, t.current_condition
--      from public.trees t
--      join public.tree_plantings tp
--        on tp.tree_id = t.id and tp.ended_at is null
--      where t.current_condition <> 'healthy'
--        and not exists (
--          select 1
--          from public.tree_condition_reports tcr
--          where tcr.tree_id = t.id
--            and tcr.is_deleted = false
--            and (tcr.reported_at at time zone 'Asia/Jakarta')::date
--                >= coalesce(tp.planted_at, (tp.created_at at time zone 'Asia/Jakarta')::date)
--        );
--
--    -> harus kosong.
--
-- 6. Kolom kategori terisi hanya pada cabang perawatan:
--
--      select history_type, count(*) filter (where kategori is not null) as terisi
--      from public.tree_history_view
--      group by history_type
--      order by history_type;
--
--    -> hanya baris 'care' yang punya nilai terisi > 0; tiga lainnya 0.
--       (Baris 'care' dengan kategori NULL tetap wajar: care_activities.category
--        nullable, dan perawatan TERJADWAL lama bisa tidak punya kategori.)
--
-- 7. View masih security_invoker dan masih bisa dibaca authenticated:
--
--      select c.relname, c.reloptions
--      from pg_class c where c.relname = 'tree_history_view';
--
--    -> reloptions memuat security_invoker=true.
--
--      select has_table_privilege('authenticated', 'public.tree_history_view', 'select');
--
--    -> true.
-- ===========================================================================
