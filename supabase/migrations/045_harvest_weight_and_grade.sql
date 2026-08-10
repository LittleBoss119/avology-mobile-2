-- 045_harvest_weight_and_grade.sql
--
-- Panen diukur dalam KILOGRAM, dan kualitasnya dinyatakan sebagai grade.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Seluruh target pemilik kebun berbasis berat: minimal 2 kg per m², target
-- 13 ton dari 6.500 m², dan satu pohon diharapkan menghasilkan 30 kg di tahun
-- ketiga. Tabel panen sekarang hanya menyimpan fruit_count (jumlah buah), dan
-- jumlah buah TIDAK BISA dikonversi ke kilogram: berat alpukat bervariasi jauh
-- antar buah, jadi angka konversi apa pun akan mengarang.
--
-- fruit_condition sekarang teks bebas, dan 12 baris yang ada sudah berisi
-- "Bagus", "Baik", "Good", dan "Good test harvest" -- empat nilai untuk satu
-- maksud, dari satu orang. Pemiliknya sendiri memetakan kualitas sebagai
-- Grade A1 / A2 / A3, jadi itu yang dipakai.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DILAKUKAN
--
--   * TIDAK membuat enum baru untuk grade. Grade adalah klasifikasi milik satu
--     kebun, bukan konsep universal; menaruhnya di enum berarti butuh migrasi
--     lagi setiap kali daftarnya berubah. CHECK pada kolom text sudah cukup.
--   * TIDAK memberi harvest_weight_kg nilai default. 12 baris lama memang tidak
--     punya berat, dan default apa pun akan jadi angka bohong yang mencemari
--     perhitungan total panen nanti. NULL berarti "tidak diukur", dan itu jujur.
--   * TIDAK membersihkan 12 baris fruit_condition lama. Pemetaan
--     "Bagus"/"Baik"/"Good" ke A1/A2/A3 adalah keputusan pemilik kebun, bukan
--     keputusan migrasi. Karena itu constraint grade dipasang NOT VALID.
--
-- Nomor 017 dan 042 memang tidak pernah ada. Bukan hilang -- jangan diisi.

-- ---------------------------------------------------------------------------
-- 1. Kolom berat panen
-- ---------------------------------------------------------------------------

alter table public.harvest_records
  add column if not exists harvest_weight_kg numeric(10,2);

comment on column public.harvest_records.harvest_weight_kg is
  'Berat panen dalam kilogram. NULL = tidak ditimbang. Bukan hasil konversi dari fruit_count -- berat alpukat terlalu bervariasi untuk dikonversi.';

-- Batas atas 100000 kg adalah pagar salah ketik (kelebihan nol), bukan batas
-- agronomis. Nol dan negatif ditolak: "panen 0 kg" sama saja dengan tidak
-- menimbang, dan itu diwakili NULL.
--
-- Seluruh baris lama bernilai NULL di kolom ini, jadi constraint aman
-- divalidasi penuh -- tanpa NOT VALID.
alter table public.harvest_records
  drop constraint if exists harvest_records_harvest_weight_kg_check;

alter table public.harvest_records
  add constraint harvest_records_harvest_weight_kg_check
  check (
    harvest_weight_kg is null
    or (harvest_weight_kg > 0 and harvest_weight_kg <= 100000)
  );

-- ---------------------------------------------------------------------------
-- 2. fruit_count jadi opsional
--
-- Kalau kilogram yang jadi metriknya, memaksa pekerja menghitung buah satu per
-- satu adalah pajak yang tidak perlu. Menimbang satu keranjang jauh lebih cepat
-- daripada membilang isinya.
--
-- CATATAN soal constraint lama: harvest_records_fruit_count_check
-- (check fruit_count > 0, dari migrasi 020) SENGAJA TIDAK DISENTUH. Constraint
-- CHECK lolos untuk NULL -- `null > 0` bernilai NULL, bukan FALSE -- sehingga
-- aturan "kalau diisi harus lebih dari 0" tetap berlaku persis seperti dulu
-- tanpa perlu ditulis ulang. Menyentuhnya justru berisiko mengubah maknanya.
-- ---------------------------------------------------------------------------

alter table public.harvest_records
  alter column fruit_count drop not null;

-- Panen tanpa angka apa pun tidak ada gunanya dicatat. Minimal salah satu dari
-- jumlah buah atau berat harus ada.
--
-- Aman divalidasi penuh: seluruh baris lama punya fruit_count (dulu NOT NULL),
-- jadi tidak ada satu pun yang melanggar.
alter table public.harvest_records
  drop constraint if exists harvest_records_amount_present_check;

alter table public.harvest_records
  add constraint harvest_records_amount_present_check
  check (fruit_count is not null or harvest_weight_kg is not null);

-- ---------------------------------------------------------------------------
-- 3. fruit_condition jadi grade
--
-- WAJIB NOT VALID, dan ini bukan kemalasan.
--
-- 12 baris lama berisi teks bebas ("Bagus", "Baik", "Good", "Good test
-- harvest") yang pasti gagal. NOT VALID mengunci baris BARU dan setiap baris
-- lama yang di-UPDATE, tanpa memaksa pembersihan data lama lebih dulu.
-- Pembersihannya dilakukan terpisah lewat skrip di scripts/, BUKAN migrasi,
-- karena pemetaan tiap teks lama ke grade adalah keputusan pemilik kebun.
--
-- Setelah data lama bersih, constraint ini bisa divalidasi dengan:
--   alter table public.harvest_records
--     validate constraint harvest_records_fruit_condition_grade_check;
-- ---------------------------------------------------------------------------

comment on column public.harvest_records.fruit_condition is
  'Grade kualitas panen: A1, A2, atau A3. NULL = tidak dinilai. Dulu teks bebas; 12 baris lama masih memuat teks lama dan dikecualikan constraint NOT VALID.';

alter table public.harvest_records
  drop constraint if exists harvest_records_fruit_condition_grade_check;

alter table public.harvest_records
  add constraint harvest_records_fruit_condition_grade_check
  check (fruit_condition is null or fruit_condition in ('A1', 'A2', 'A3'))
  not valid;

-- ---------------------------------------------------------------------------
-- 4. update_own_harvest_record -- terima berat, dan jangan lagi mewajibkan
--    jumlah buah
--
-- Signature lama menolak NULL di baris pertama badannya
-- (`if p_fruit_count is null or p_fruit_count <= 0 then raise`), jadi panen
-- berbasis-berat mustahil disimpan lewat jalur ini.
--
-- Signature lama WAJIB di-drop dulu. `create or replace` dengan parameter
-- tambahan hanya akan membuat OVERLOAD, lalu pemanggilan lama jadi ambigu
-- ("function is not unique") -- kelas bug yang sama dengan migrasi 024.
--
-- Pesan exception BARU ditulis Bahasa Indonesia supaya bisa dibaca pekerja di
-- lapangan. Dua pesan LAMA yang tidak disentuh ('Harvest record not found' dan
-- 'Harvest record is deleted') sengaja dibiarkan apa adanya agar penanganan
-- error di klien tidak bergeser.
-- ---------------------------------------------------------------------------

drop function if exists public.update_own_harvest_record(uuid, integer, text, text, timestamptz);

create or replace function public.update_own_harvest_record(
  p_record_id uuid,
  p_fruit_count integer default null,
  p_fruit_condition text default null,
  p_note text default null,
  p_harvested_at timestamptz default null,
  p_harvest_weight_kg numeric default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
  target_record record;
  clean_condition text := nullif(trim(p_fruit_condition), '');
begin
  -- Semua parameter bersifat MENGGANTI, bukan menambal: nilai yang tidak
  -- dikirim akan mengosongkan kolomnya. Ini mempertahankan perilaku RPC lama
  -- untuk fruit_condition dan note, dan membuat aturan "minimal salah satu
  -- terisi" di bawah bisa diuji langsung dari parameternya.
  if p_fruit_count is null and p_harvest_weight_kg is null then
    raise exception 'Isi jumlah buah atau berat panen, minimal salah satu.';
  end if;

  if p_fruit_count is not null and p_fruit_count <= 0 then
    raise exception 'Jumlah buah harus lebih dari 0.';
  end if;

  if p_harvest_weight_kg is not null
     and (p_harvest_weight_kg <= 0 or p_harvest_weight_kg > 100000) then
    raise exception 'Berat panen harus lebih dari 0 dan tidak lebih dari 100000 kg.';
  end if;

  if clean_condition is not null and clean_condition not in ('A1', 'A2', 'A3') then
    raise exception 'Grade panen harus A1, A2, atau A3.';
  end if;

  select id, farm_id, harvested_by, is_deleted
  into target_record
  from public.harvest_records
  where id = p_record_id;

  if not found then
    raise exception 'Harvest record not found';
  end if;

  if target_record.is_deleted then
    raise exception 'Harvest record is deleted';
  end if;

  perform public.ensure_record_owner_active_member(
    target_record.farm_id,
    target_record.harvested_by,
    current_user_id
  );

  -- updated_at diisi eksplisit. Tabel ini SUDAH punya trigger
  -- set_harvest_records_updated_at (BEFORE UPDATE, migrasi 020) yang melakukan
  -- hal sama, jadi baris ini bersifat sabuk-dan-bretel: kalau trigger itu
  -- ternyata hilang di suatu environment (drift semacam ini sudah pernah
  -- terjadi -- lihat migrasi 044), updated_at tetap terisi.
  update public.harvest_records
  set fruit_count = p_fruit_count,
      fruit_condition = clean_condition,
      harvest_weight_kg = p_harvest_weight_kg,
      note = nullif(trim(p_note), ''),
      harvested_at = coalesce(p_harvested_at, harvested_at),
      updated_at = now()
  where id = p_record_id;
end;
$function$;

-- WAJIB. DROP FUNCTION menghapus grant yang menempel pada fungsi lama
-- (migrasi 023 memberikannya untuk signature 5 parameter).
revoke execute on function public.update_own_harvest_record(uuid, integer, text, text, timestamptz, numeric)
  from public, anon;

grant execute on function public.update_own_harvest_record(uuid, integer, text, text, timestamptz, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. tree_history_view -- cabang panen tahan-NULL
--
-- Cabang panen lama meng-concat fruit_count TANPA penjaga null:
--   concat('Jumlah buah: ', hr.fruit_count::text, ...)
-- Begitu kolomnya nullable, setiap panen berbasis-berat akan menampilkan
-- "Jumlah buah: " kosong menggantung di timeline pohon.
--
-- concat_ws dipakai karena ia MELEWATI argumen NULL, jadi bagian yang tidak
-- ada hilang bersama pemisahnya -- bukan menyisakan ". " menggantung seperti
-- concat biasa. nullif(..., '') di tiap bagian menangani string kosong yang
-- tidak dilewati concat_ws.
--
-- Berat dirapikan dari '12.00' jadi '12' dan '0.50' jadi '0.5': nol di
-- belakang koma tidak menambah informasi apa pun buat pembaca timeline.
--
-- TIGA CABANG LAIN (kondisi, fase, perawatan) DISALIN PERSIS dari migrasi 032,
-- tanpa satu pun perubahan. Daftar dan urutan kolom juga tidak berubah
-- (source_id, tree_id, farm_id, history_type, title, description, actor_id,
-- happened_at, asal, produk), sehingga `create or replace view` sah dan tidak
-- perlu drop -- penting, karena historyService.ts membaca view ini.
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
    null::text as produk
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
    null::text as produk
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
    nullif(trim(both from ca.produk), ''::text) as produk
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
    null::text as produk
   from harvest_records hr
  where hr.is_deleted = false;

-- ---------------------------------------------------------------------------
-- 6. Muat ulang cache schema PostgREST
--
-- Signature update_own_harvest_record berubah dan harvest_records punya kolom
-- baru; keduanya harus dikenali PostgREST sebelum klien memakainya.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. Kolom baru ada dan nullable:
--
--      select column_name, data_type, numeric_precision, numeric_scale, is_nullable
--      from information_schema.columns
--      where table_schema = 'public' and table_name = 'harvest_records'
--        and column_name in ('fruit_count', 'harvest_weight_kg');
--
--    -> fruit_count harus is_nullable = YES
--    -> harvest_weight_kg harus numeric(10,2), is_nullable = YES
--
-- 2. Constraint terpasang, dan HANYA grade yang belum tervalidasi:
--
--      select conname, convalidated, pg_get_constraintdef(oid)
--      from pg_constraint
--      where conrelid = 'public.harvest_records'::regclass and contype = 'c'
--      order by conname;
--
--    -> harvest_records_fruit_count_check          convalidated = true
--    -> harvest_records_harvest_weight_kg_check    convalidated = true
--    -> harvest_records_amount_present_check       convalidated = true
--    -> harvest_records_fruit_condition_grade_check convalidated = FALSE
--
-- 3. update_own_harvest_record TIDAK ter-overload -- harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'update_own_harvest_record';
--
-- 4. Grant-nya menempel kembali:
--
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'update_own_harvest_record';
--
--    -> `authenticated` wajib muncul. Kalau tidak, edit panen kena
--       "permission denied".
--
-- 5. Timeline panen tidak lagi menggantung. Semua baris harus punya
--    description yang tidak kosong dan tidak diakhiri pemisah:
--
--      select source_id, description
--      from public.tree_history_view
--      where history_type = 'harvest'
--      order by happened_at desc
--      limit 20;
--
-- 6. Trigger updated_at masih terpasang (dipakai bersama baris eksplisit di
--    dalam RPC):
--
--      select tgname from pg_trigger t
--      join pg_class c on c.oid = t.tgrelid
--      where c.relname = 'harvest_records' and not t.tgisinternal
--      order by tgname;
--
--    -> set_harvest_records_updated_at dan validate_harvest_record_trigger
--       keduanya harus ada.
-- ---------------------------------------------------------------------------
