-- ===========================================================================
-- 067 -- Hapus catatan (soft delete)
--
-- Empat jenis catatan pohon kini bisa dihapus: kondisi, fase, panen, dan
-- perawatan INISIATIF. Menghapus di sini berarti MENANDAI, bukan membuang --
-- barisnya tetap ada, hanya berhenti dihitung dan berhenti ditampilkan.
--
--
-- IZIN YANG BERLAKU DI BERKAS INI, DAN KENAPA IA BUKAN "own"
--
--   * Pencatatnya boleh menghapus catatannya sendiri.
--   * Pemilik kebun boleh menghapus catatan siapa pun di kebunnya.
--
-- Itu LEBIH LUAS daripada aturan yang sudah ada untuk MENGUBAH catatan, dan
-- perbedaannya disengaja. ensure_record_owner_active_member (023:214) menolak
-- siapa pun selain pencatatnya, dan seluruh RPC update_own_* bergantung padanya
-- -- tidak satu pun disentuh di sini. Mengubah catatan orang lain berarti
-- menaruh kata-kata di mulut orang itu: catatannya tetap tercantum atas namanya
-- padahal isinya sudah bukan miliknya. Menghapus tidak punya masalah itu -- yang
-- terjadi hanya catatan itu berhenti dihitung, dan jejak siapa yang
-- menghapusnya tersimpan di deleted_by.
--
-- Karena itu helper izinnya BARU dan berdiri sendiri (bagian 2), bukan
-- ensure_record_owner_active_member yang dilonggarkan. Melonggarkan yang lama
-- akan diam-diam memberi pemilik hak MENGEDIT catatan pekerjanya juga, lewat
-- keempat RPC update_own_* yang memakainya.
--
--
-- PERAWATAN TERJADWAL TIDAK BISA DIHAPUS
--
-- Ia bukan catatan bebas melainkan REALISASI sebuah tugas: baris care_activities
-- yang menutup care_tasks, menggerakkan rantai jadwal berulang, dan mengunci
-- jadwal induknya. Membatalkannya sudah punya jalur sendiri yang mengurus
-- seluruh akibat itu -- rollback_completed_task_activity (044:122). Soft delete
-- di sini hanya akan menyembunyikan barisnya sambil meninggalkan tugas, rantai,
-- dan kunci jadwalnya dalam keadaan yang mengira pekerjaan itu masih ada.
--
--
-- KOLOM PEMBEDA: ca.asal = 'inisiatif'. Rincinya di bagian 3d.
-- ===========================================================================

begin;


-- ---------------------------------------------------------------------------
-- 1. Kolom soft delete di care_activities
--
-- Tiga tabel catatan lain sudah punya keempatnya sejak 023:1-27. care_activities
-- tertinggal karena saat itu ia belum dianggap catatan yang bisa dihapus.
-- Bentuknya DISALIN PERSIS dari blok harvest_records (023:17-21) -- empat kolom,
-- nama dan tipe yang sama, tanpa tambahan. created_at sudah ada sejak 066;
-- updated_at sengaja TIDAK ditambahkan karena harvest_records dan
-- manual_care_records pun tidak mendapatnya di 023.
--
-- FK deleted_by -> profiles(id) on delete set null, dibungkus penjaga
-- keberadaan constraint, mengikuti pola 023:29-60 apa adanya. `set null`, bukan
-- cascade: profil penghapus boleh lenyap tanpa membawa catatannya ikut lenyap.
--
--
-- INI TIDAK MELANGGAR SIFAT APPEND-ONLY care_activities.
--
-- Yang append-only adalah INSERT-nya: satu tugas boleh punya banyak baris, dan
-- tidak ada baris yang ditimpa atau dihapus (043:6). Soft delete adalah UPDATE
-- pada kolom PENANDA, bukan DELETE dan bukan perubahan isi catatannya --
-- note, produk, category, performed_at, dan performed_by semuanya tidak
-- tersentuh. Ledger-nya tetap utuh; yang berubah hanya apakah sebuah baris ikut
-- dihitung.
--
--
-- DIPERIKSA SEBELUM MENULIS: apa yang berbunyi saat care_activities di-UPDATE.
--
-- Tabel ini punya lima trigger, dan hanya SATU yang menyentuh UPDATE:
--
--   validate_care_activity_trigger              BEFORE INSERT   (006:507-509)
--   sync_task_status_from_activity_trigger      AFTER  INSERT   (006:512-515)
--   zz_create_next_recurring_schedule_trigger   AFTER  INSERT   (041:167-169)
--   zz_cleanup_orphan_recurring_schedule_trigger AFTER DELETE   (041:235-237)
--   sync_task_due_date_from_postponement_trigger AFTER INSERT OR UPDATE (049:131-134)
--
-- Yang terakhir memang ikut berbunyi pada soft delete, tapi ia BERHENTI DI
-- BARIS PERTAMA badannya: `if new.care_task_id is null then return new; end if;`
-- (049:106-108). Perawatan inisiatif -- satu-satunya yang boleh dihapus berkas
-- ini -- selalu punya care_task_id NULL, dijamin constraint
-- care_activities_asal_source_check (025:44-47). Jadi ia tidak pernah sampai ke
-- UPDATE care_tasks di dalamnya. Bahkan seandainya sampai, ia hanya bertindak
-- untuk baris berstatus 'postponed' yang punya postponed_until.
--
-- Tidak ada satu pun policy yang memblokir UPDATE: care_activities memang tidak
-- punya policy UPDATE sama sekali, dan grant-nya hanya `select, insert`
-- (007:357). Itu bukan penghalang bagi RPC di bawah -- keempatnya SECURITY
-- DEFINER, berjalan sebagai pemilik tabel dan karena itu melewati RLS maupun
-- grant. Klien tetap TIDAK bisa meng-UPDATE tabel ini langsung, dan itu memang
-- yang diinginkan.
-- ---------------------------------------------------------------------------

alter table public.care_activities
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid,
add column if not exists delete_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'care_activities_deleted_by_fkey'
      and conrelid = 'public.care_activities'::regclass
  ) then
    alter table public.care_activities
    add constraint care_activities_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id) on delete set null;
  end if;
end;
$$;

comment on column public.care_activities.is_deleted is
  'Penanda hapus lunak (067). Hanya perawatan INISIATIF yang bisa disetel true; perawatan terjadwal dibatalkan lewat rollback_completed_task_activity.';


-- ---------------------------------------------------------------------------
-- 2. Helper izin: ensure_can_delete_farm_record
--
-- Fungsi BARU, bukan pelonggaran ensure_record_owner_active_member. Alasannya
-- ada di kepala berkas: yang lama dipakai keempat RPC update_own_*, dan
-- melonggarkannya akan memberi pemilik hak mengedit catatan pekerjanya sebagai
-- efek samping yang tidak diminta siapa pun.
--
-- Urutan pemeriksaannya dipilih supaya pesannya tepat, bukan sekadar benar:
--
--   1. Belum login              -> pesan login.
--   2. Pemilik aktif kebun itu  -> LOLOS, tanpa memeriksa siapa pencatatnya.
--      is_active_owner sudah mensyaratkan keanggotaan aktif, jadi tidak ada
--      pemeriksaan kedua yang perlu.
--   3. Bukan pencatatnya        -> pesan "hanya pencatat atau pemilik".
--   4. Pencatatnya, tapi sudah bukan anggota aktif -> pesan keanggotaan.
--
-- Nomor 4 bukan kasus mengada-ada: pekerja yang aksesnya dicabut masih memegang
-- id yang cocok dengan reported_by pada catatan lamanya. Ia tidak boleh
-- menyentuh kebun yang sudah bukan miliknya lagi.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_can_delete_farm_record(
  p_farm_id uuid,
  p_author_id uuid,
  p_current_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_current_user_id is null then
    raise exception 'Silakan login terlebih dahulu.';
  end if;

  if public.is_active_owner(p_farm_id, p_current_user_id) then
    return;
  end if;

  if p_author_id is distinct from p_current_user_id then
    raise exception 'Catatan ini hanya bisa dihapus oleh pencatatnya atau pemilik kebun.';
  end if;

  if not public.is_active_farm_member(p_farm_id, p_current_user_id) then
    raise exception 'Hanya anggota aktif kebun yang dapat menghapus catatan.';
  end if;
end;
$$;

revoke execute on function public.ensure_can_delete_farm_record(uuid, uuid, uuid)
  from public, anon;


-- ---------------------------------------------------------------------------
-- 3. Empat RPC hapus
--
-- Bentuknya mengikuti soft_delete_own_tree_condition_report (023:283-324) yang
-- dicabut migrasi 031:124-127: baca baris target, tolak kalau tidak ada, tolak
-- kalau sudah terhapus, periksa izin, UPDATE penanda, lalu hitung ulang kolom
-- turunan. Dua hal yang berbeda dari bentuk lama:
--
--   * namanya TANPA `_own_`. Izinnya bukan lagi "own" (bagian 2), dan nama yang
--     mengatakan sebaliknya akan berbohong kepada pembaca berikutnya. Nama
--     lamanya juga sudah di-drop 031, jadi tidak ada tabrakan.
--   * cabang perawatan punya penjaga tambahan untuk asal (bagian 3d).
--
--
-- KENAPA recalculate DIPANGGIL EKSPLISIT, dan kenapa itu BUKAN panggilan ganda.
--
-- Diperiksa: sync_tree_current_condition_trigger (006:477-480) dan
-- sync_tree_current_growth_phase_trigger (006:525-528) keduanya AFTER **INSERT**
-- saja. Soft delete adalah UPDATE, jadi tidak satu pun dari keduanya berbunyi.
-- Tanpa perform di bawah, menghapus catatan kondisi terakhir akan menyembunyikan
-- catatannya sementara trees.current_condition tetap memegang nilai dari catatan
-- yang sudah tidak ada.
--
-- Sesudah migrasi 066, recalculate_tree_current_growth_phase juga menulis
-- current_growth_phase_since dari baris yang sama, jadi umur fase di layar detail
-- ikut mundur ke catatan sebelumnya tanpa perlu disebut terpisah di sini.
--
-- PANEN DAN PERAWATAN TIDAK MEMANGGIL recalculate apa pun, dan itu bukan
-- kelalaian: tidak ada kolom turunan di trees yang diturunkan dari harvest_records
-- maupun care_activities. Tidak ada yang perlu dimundurkan.
-- ---------------------------------------------------------------------------

-- 3a. Kondisi
create or replace function public.soft_delete_tree_condition_report(
  p_report_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_report record;
begin
  select id, farm_id, tree_id, reported_by, is_deleted
  into target_report
  from public.tree_condition_reports
  where id = p_report_id;

  if not found then
    raise exception 'Catatan kondisi tidak ditemukan.';
  end if;

  if target_report.is_deleted then
    raise exception 'Catatan kondisi ini sudah dihapus.';
  end if;

  perform public.ensure_can_delete_farm_record(
    target_report.farm_id,
    target_report.reported_by,
    current_user_id
  );

  update public.tree_condition_reports
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(btrim(p_reason), '')
  where id = p_report_id;

  perform public.recalculate_tree_current_condition(target_report.tree_id);
end;
$$;

-- 3b. Fase
create or replace function public.soft_delete_growth_phase_record(
  p_record_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, tree_id, recorded_by, is_deleted
  into target_record
  from public.growth_phase_records
  where id = p_record_id;

  if not found then
    raise exception 'Catatan fase tidak ditemukan.';
  end if;

  if target_record.is_deleted then
    raise exception 'Catatan fase ini sudah dihapus.';
  end if;

  perform public.ensure_can_delete_farm_record(
    target_record.farm_id,
    target_record.recorded_by,
    current_user_id
  );

  update public.growth_phase_records
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(btrim(p_reason), '')
  where id = p_record_id;

  perform public.recalculate_tree_current_growth_phase(target_record.tree_id);
end;
$$;

-- 3c. Panen
create or replace function public.soft_delete_harvest_record(
  p_record_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record record;
begin
  select id, farm_id, tree_id, harvested_by, is_deleted
  into target_record
  from public.harvest_records
  where id = p_record_id;

  if not found then
    raise exception 'Catatan panen tidak ditemukan.';
  end if;

  if target_record.is_deleted then
    raise exception 'Catatan panen ini sudah dihapus.';
  end if;

  perform public.ensure_can_delete_farm_record(
    target_record.farm_id,
    target_record.harvested_by,
    current_user_id
  );

  update public.harvest_records
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(btrim(p_reason), '')
  where id = p_record_id;
end;
$$;

-- 3d. Perawatan INISIATIF
--
-- KOLOM PEMBEDANYA: ca.asal = 'inisiatif'.
--
-- Ada dua kolom yang sebenarnya bisa dipakai, dan keduanya SELALU sepakat --
-- constraint care_activities_asal_source_check (025:44-47) mengikat keduanya:
--
--     (asal = 'terjadwal' and care_task_id is not null)
--     or (asal = 'inisiatif' and care_task_id is null and category is not null)
--
-- Jadi `asal = 'inisiatif'` dan `care_task_id is null` tidak mungkin berbeda
-- jawabannya. Yang dipilih `asal` karena ia kolom yang MENYATAKAN maksudnya:
-- ia berisi kata yang sama dengan yang dilihat pengguna di layar ("Inisiatif"
-- lawan "Terjadwal"), sedangkan care_task_id menyatakan strukturnya dan baru
-- berarti "inisiatif" setelah pembacanya tahu constraint di atas.
--
-- Penjaganya diletakkan SEBELUM pemeriksaan izin. Alasannya pesan: pemilik
-- kebun LOLOS pemeriksaan izin untuk catatan apa pun, jadi kalau urutannya
-- dibalik ia akan lolos izin lalu ditolak karena jenisnya -- dua langkah untuk
-- satu penolakan. Yang benar adalah menolak jenisnya lebih dulu, karena
-- larangan ini berlaku untuk SEMUA ORANG termasuk pemilik.
create or replace function public.soft_delete_care_activity(
  p_activity_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_activity record;
begin
  select id, farm_id, performed_by, asal, is_deleted
  into target_activity
  from public.care_activities
  where id = p_activity_id;

  if not found then
    raise exception 'Catatan perawatan tidak ditemukan.';
  end if;

  if target_activity.is_deleted then
    raise exception 'Catatan perawatan ini sudah dihapus.';
  end if;

  if target_activity.asal is distinct from 'inisiatif' then
    raise exception
      'Perawatan terjadwal tidak bisa dihapus. Batalkan hasil kerjanya dari layar tugas.';
  end if;

  perform public.ensure_can_delete_farm_record(
    target_activity.farm_id,
    target_activity.performed_by,
    current_user_id
  );

  update public.care_activities
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = current_user_id,
      delete_reason = nullif(btrim(p_reason), '')
  where id = p_activity_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3e. Hak akses keempat RPC
--
-- Pola yang sama dengan seluruh RPC di basis kode ini: dicabut dari public dan
-- anon, diberikan ke authenticated. Pemeriksaan siapa-boleh-apa ada di dalam
-- fungsinya, bukan di grant -- grant hanya memastikan pemanggilnya sudah login.
-- ---------------------------------------------------------------------------

revoke execute on function public.soft_delete_tree_condition_report(uuid, text) from public, anon;
revoke execute on function public.soft_delete_growth_phase_record(uuid, text) from public, anon;
revoke execute on function public.soft_delete_harvest_record(uuid, text) from public, anon;
revoke execute on function public.soft_delete_care_activity(uuid, text) from public, anon;

grant execute on function public.soft_delete_tree_condition_report(uuid, text) to authenticated;
grant execute on function public.soft_delete_growth_phase_record(uuid, text) to authenticated;
grant execute on function public.soft_delete_harvest_record(uuid, text) to authenticated;
grant execute on function public.soft_delete_care_activity(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. tree_history_view -- cabang perawatan ikut menyaring is_deleted
--
-- DIPERIKSA, bukan diasumsikan. Tiga cabang sudah menyaring sejak 023 dan tidak
-- berubah sejak itu:
--
--   condition -> where tcr.is_deleted = false
--   phase     -> where gpr.is_deleted = false
--   harvest   -> where hr.is_deleted = false
--   care      -> TIDAK ADA where sama sekali
--
-- Cabang perawatan tertinggal karena kolomnya memang baru lahir di bagian 1
-- berkas ini. Tanpa baris `where ca.is_deleted = false`, seluruh pekerjaan di
-- atas tidak terlihat: catatan perawatan yang dihapus akan tetap muncul di
-- riwayat pohon seolah tidak terjadi apa-apa.
--
-- Sebelas kolom lain DISALIN APA ADANYA dari 066:516-687 -- daftar, urutan, dan
-- tipenya tidak berubah sama sekali, jadi `create or replace` sah.
--
-- TIDAK DI-DROP, dengan alasan yang sama seperti 065 dan 066: view ini punya
-- `with (security_invoker = true)` (028:26-27) dan `grant select ... to
-- authenticated` (028:103). Keduanya hilang diam-diam kalau view di-drop, dan
-- security_invoker yang hilang berarti view berjalan sebagai pemiliknya dan
-- melewati RLS -- kebocoran data lintas kebun.
--
-- WHERE-nya ditaruh SESUDAH kedua join, bukan dijadikan syarat join. Untuk
-- inner join hasilnya sama, tapi ca.is_deleted adalah syarat atas baris
-- care_activities-nya sendiri, bukan atas hubungannya dengan tabel lain.
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
  where ca.is_deleted = false
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
  'Riwayat satu pohon dari empat tabel catatan. Keempat cabang menyaring is_deleted = false (cabang perawatan sejak 067). kategori (065) hanya terisi pada cabang perawatan. dibuat_pada (066) adalah waktu baris ditulis -- pemecah seri kronologis untuk happened_at.';


-- ---------------------------------------------------------------------------
-- 5. Muat ulang cache schema PostgREST
--
-- care_activities bertambah empat kolom dan ada empat fungsi baru yang harus
-- bisa dipanggil klien lewat rpc(). Tanpa reload, panggilan pertama ke keempatnya
-- gagal dengan "function not found".
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

commit;


-- ===========================================================================
-- VERIFIKASI MANUAL (jalankan sesudah push; tidak dijalankan otomatis)
--
-- 1. Keempat fungsi ada dan hanya bisa dipanggil authenticated:
--
--      select p.proname,
--             has_function_privilege('authenticated', p.oid, 'execute') as boleh_auth,
--             has_function_privilege('anon', p.oid, 'execute') as boleh_anon
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname like 'soft_delete_%'
--      order by p.proname;
--
--    -> empat baris, boleh_auth true, boleh_anon false.
--
-- 2. Perawatan TERJADWAL ditolak, apa pun pemanggilnya. Sebagai pemilik kebun:
--
--      select public.soft_delete_care_activity('<activity terjadwal>');
--
--    -> exception 'Perawatan terjadwal tidak bisa dihapus...'.
--
-- 3. Perawatan INISIATIF milik pekerja bisa dihapus pemilik kebun, dan
--    menghilang dari riwayat:
--
--      select public.soft_delete_care_activity('<activity inisiatif>', 'salah catat');
--      select count(*) from public.tree_history_view
--      where source_id = '<activity inisiatif>';
--
--    -> 0.
--
-- 4. Orang ketiga (pekerja lain, bukan pencatat, bukan pemilik) ditolak:
--
--      select public.soft_delete_tree_condition_report('<report orang lain>');
--
--    -> exception 'Catatan ini hanya bisa dihapus oleh pencatatnya atau pemilik kebun.'
--
-- 5. Menghapus dua kali ditolak:
--
--      select public.soft_delete_tree_condition_report('<report yang sama>');
--
--    -> exception '... sudah dihapus.'
--
-- 6. Kolom turunan MUNDUR ke catatan sebelumnya. Pada pohon dengan dua catatan
--    fase (mis. 'vegetative' lalu 'flowering'), hapus yang terbaru:
--
--      select public.soft_delete_growth_phase_record('<record flowering>');
--      select current_growth_phase, current_growth_phase_since
--      from public.trees where id = '<tree>';
--
--    -> 'vegetative', dan tanggalnya tanggal catatan vegetative itu.
--
--    Hapus juga yang tersisa:
--
--      select public.soft_delete_growth_phase_record('<record vegetative>');
--      select current_growth_phase, current_growth_phase_since
--      from public.trees where id = '<tree>';
--
--    -> NULL, NULL.
--
-- 7. Hal yang sama untuk kondisi, termasuk jatuh kembali ke default:
--
--      select public.soft_delete_tree_condition_report('<satu-satunya report>');
--      select current_condition from public.trees where id = '<tree>';
--
--    -> 'healthy' (coalesce di recalculate_tree_current_condition).
--
-- 8. Update masih TERKUNCI ke pencatatnya -- pemilik TIDAK mendapat hak edit
--    sebagai efek samping berkas ini. Sebagai pemilik, atas catatan pekerja:
--
--      select public.update_own_tree_condition_report(
--        '<report pekerja>', 'healthy'::public.tree_condition_status, null, null);
--
--    -> exception 'Only record author can change this record'.
--
-- 9. Keempat cabang view menyaring is_deleted:
--
--      select pg_get_viewdef('public.tree_history_view'::regclass, true);
--
--    -> empat kali 'is_deleted = false', satu per cabang.
--
-- 10. Klien tetap tidak bisa meng-UPDATE care_activities langsung:
--
--      select has_table_privilege('authenticated', 'public.care_activities', 'update');
--
--    -> false.
-- ===========================================================================
