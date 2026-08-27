-- 060_initiative_care_proof_photo.sql
--
-- Foto untuk catatan perawatan INISIATIF.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN FITUR BARU
--
-- care_activities menampung DUA jenis baris yang dipisahkan
-- care_activities_asal_source_check (025:44):
--
--     asal = 'terjadwal' -> care_task_id NOT NULL
--     asal = 'inisiatif' -> care_task_id NULL, category NOT NULL
--
-- Separuh yang 'terjadwal' sudah bisa berfoto sejak 016 lewat
-- entity_type = 'task_proof'. Separuh yang 'inisiatif' tidak bisa sama sekali,
-- karena can_upload_task_proof_photo (019:232) menjoin care_tasks lewat
-- ca.care_task_id -- yang untuk baris itu NULL, sehingga join-nya kosong dan
-- policy-nya selalu false.
--
-- Jadi yang ditambal di sini lubang di separuh baris sebuah tabel yang separuh
-- lainnya sudah punya foto, bukan tabel kosong yang perlu fitur.
--
-- ---------------------------------------------------------------------------
-- KENAPA ENTITY_TYPE BARU, BUKAN MEMPERLUAS 'task_proof'
--
-- Yang menutup pilihan ini adalah TATA BAHASA storage_path, bukan selera.
--
-- Path 'task-proofs' punya LIMA segmen, dan segmen keempatnya id tugas:
--
--     farms/<farm_id>/task-proofs/<task_id>/<activity_id>/<berkas>
--
-- Bentuk itu bukan konvensi. Ia dibaca dua fungsi immutable --
-- avology_storage_path_entity_id() yang mengambil segmen KELIMA khusus untuk
-- folder ini (019:57) dan avology_storage_path_task_id() yang mengambil segmen
-- KEEMPAT (019:68) -- ditegakkan photo_attachments_storage_path_entity_id_check,
-- dan dipakai policy insert untuk memanggil
-- can_upload_task_proof_photo(farm, SEGMEN 4, entity_id, uid).
--
-- Aktivitas inisiatif TIDAK PUNYA id tugas. Memperluas 'task_proof' berarti
-- mengarang isi segmen keempat -- id aktivitas yang diulang, atau teks non-uuid
-- yang jatuh ke `exception when invalid_text_representation` dan jadi NULL.
-- Dua-duanya menuliskan kebohongan ke dalam path yang empat CHECK constraint
-- dan enam policy perlakukan sebagai fakta.
--
-- entity_type baru cukup memakai path EMPAT segmen, yaitu cabang generik
-- avology_storage_path_entity_id yang sudah ada. Nol fungsi path baru, nol
-- perubahan pada keempat helper path.
--
-- Alasan kedua: kalau 'task_proof' diperluas, diskriminator
-- `care_task_id IS NULL` harus dijejalkan ke EMPAT tempat -- fungsi unggah,
-- fungsi baca, tata bahasa path, dan trigger planting_id bagian 5 di bawah.
-- Satu cabang menuntut adanya tugas, cabang lain justru menuntut ketiadaannya,
-- di empat berkas berbeda. Itu bukan penyederhanaan.
--
-- KENAPA INI BUKAN "satu baris memegang dua jenis foto": satu baris
-- care_activities adalah 'terjadwal' ATAU 'inisiatif', tidak pernah dua-duanya
-- -- dipaksa care_activities_asal_source_check. Pembelahannya jatuh persis di
-- garis yang sudah ditegakkan database.
--
-- ---------------------------------------------------------------------------
-- SIAPA YANG BOLEH APA
--
-- Unggah  : HANYA pencatat aktivitas itu sendiri, yang masih anggota aktif.
-- Baca    : owner aktif, ATAU pencatatnya sendiri. TIDAK dilonggarkan jadi
--           "anggota mana pun" -- itu akan memperlebar perilaku yang stage 17
--           kunci sempit untuk task_proof, dan dua jenis bukti kerja yang
--           aturan bacanya berbeda adalah kebingungan yang tidak perlu.
-- Hapus   : owner aktif (cabang pertama policy, sudah ada), ATAU pengunggah
--           yang sekaligus pencatatnya.
--
-- PATOKANNYA is_active_farm_member, BUKAN is_active_worker -- dan perbedaan itu
-- disengaja. Policy "Active members can insert initiative activities" (027)
-- memakai is_active_farm_member, jadi PEMILIK pun boleh mencatat perawatan
-- inisiatif, dan memang bisa: RecordActivitySheet di tree-detail-screen.tsx
-- dirender tanpa syarat peran, dan route /care ada untuk kedua peran.
-- Memakai is_active_worker akan mengunci pemilik keluar dari fotonya sendiri.
--
-- ---------------------------------------------------------------------------
-- KEPUTUSAN 029 YANG DICABUT DI SINI
--
-- Kepala migrasi 029 memuat paragraf berjudul "KEPUTUSAN SADAR -- FOTO" yang
-- menyatakan catatan perawatan inisiatif TIDAK mendukung lampiran foto, dan
-- bahwa entity_type untuk itu sengaja tidak ditambahkan.
--
-- Migrasi ini MENCABUT keputusan tersebut. 029 sudah diterapkan dan tidak boleh
-- diedit, jadi paragraf di sana akan tetap terbaca seolah masih berlaku --
-- catatan inilah satu-satunya tempat pencabutannya tercatat. Kalau kelak ada
-- yang membaca 029 dan bingung, jawabannya di sini.
--
-- Yang berubah dari 029 hanyalah itu. Pelonggaran visibilitas care_activities
-- dan care_activity_trees yang jadi isi utama 029 tidak disentuh sama sekali.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * 'task_proof': nol perubahan. Kedua fungsinya, path lima segmennya, dan
--     cabang `entity_type = 'task_proof' -> planting_id := null` di trigger
--     059 tetap apa adanya. Kalimat "Selalu NULL untuk task_proof" yang
--     terukir di 059, src/types/media.ts, dan src/utils/treeCycle.ts TETAP
--     BENAR sesudah migrasi ini.
--   * Cabang tree_main, condition_record, dan task_proof pada keenam policy
--     disalin VERBATIM -- tidak diringkas, tidak dirapikan, tidak diurutkan
--     ulang. Satu-satunya perbedaan dari 053 bagian E adalah cabang keempat
--     yang ditambahkan.
--   * Keempat helper path (019), keempat CHECK farm/entity_id/file_size/mime.
--   * tree_history_view, is_archived.
--   * Nol baris foto dihapus, nol berkas Storage disentuh.
--
-- Nomor 017 dan 042 memang tidak pernah ada -- jangan diisi.

begin;

-- ===========================================================================
-- 1. Perlebar kedua CHECK yang mendaftar entity_type
--
-- Aman divalidasi penuh: keduanya hanya MENAMBAH nilai yang diterima, jadi
-- tidak ada baris lama yang bisa jatuh keluar.
-- ===========================================================================

alter table public.photo_attachments
  drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
  add constraint photo_attachments_entity_type_check
  check (entity_type = any (array[
    'tree_main'::text,
    'condition_record'::text,
    'task_proof'::text,
    'initiative_care_proof'::text
  ]));

alter table public.photo_attachments
  drop constraint if exists photo_attachments_storage_path_entity_folder_check;

alter table public.photo_attachments
  add constraint photo_attachments_storage_path_entity_folder_check
  check (
    public.avology_storage_path_entity_folder(storage_path) =
    case entity_type
      when 'tree_main' then 'trees'
      when 'condition_record' then 'condition-reports'
      when 'task_proof' then 'task-proofs'
      when 'initiative_care_proof' then 'initiative-care-proofs'
      else null
    end
  );

-- ===========================================================================
-- 2. Dua fungsi pendukung
--
-- SECURITY DEFINER, sama seperti keempat fungsi foto lain (019). Alasannya
-- sama pula: pemanggilnya adalah ekspresi policy, dan tanpa DEFINER fungsinya
-- akan dievaluasi di bawah RLS care_activities -- yang berarti policy foto
-- bergantung pada policy tabel lain, dan pelonggaran di sana akan merembes ke
-- sini tanpa suara.
--
-- Ketiga syarat `ca.asal = 'inisiatif'`, `ca.care_task_id is null`, dan
-- `ca.farm_id = p_farm_id` ditulis LENGKAP walau dua yang pertama sudah saling
-- menyiratkan lewat care_activities_asal_source_check. Constraint itu bisa
-- diubah migrasi lain; fungsi ini tidak boleh ikut melonggar diam-diam kalau
-- itu terjadi.
-- ===========================================================================

-- Unggah: HANYA pencatatnya. Tidak ada cabang owner -- pemilik tidak boleh
-- mengunggah bukti atas nama orang lain, persis seperti pada task_proof.
create or replace function public.can_upload_initiative_care_proof_photo(
  p_farm_id uuid,
  p_activity_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_activities ca
    where ca.id = p_activity_id
      and ca.farm_id = p_farm_id
      and ca.asal = 'inisiatif'
      and ca.care_task_id is null
      and ca.performed_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

-- Baca: owner aktif, atau pencatatnya sendiri.
--
-- Bentuknya SENGAJA menyamai can_access_task_proof_photo (019:207) dan bukan
-- can_access_condition_record_photo (019:126). Yang kedua membuka fotonya ke
-- SELURUH anggota aktif; kalau bentuk itu yang dipakai di sini, bukti kerja
-- inisiatif jadi lebih terbuka daripada bukti kerja terjadwal untuk pekerjaan
-- yang sama persis, dan asersi stage 17 yang mengunci task_proof jadi sempit
-- kehilangan artinya.
create or replace function public.can_access_initiative_care_proof_photo(
  p_farm_id uuid,
  p_activity_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_active_owner(p_farm_id, p_user_id)
    or exists (
      select 1
      from public.care_activities ca
      where ca.id = p_activity_id
        and ca.farm_id = p_farm_id
        and ca.asal = 'inisiatif'
        and ca.care_task_id is null
        and ca.performed_by = p_user_id
        and public.is_active_farm_member(p_farm_id, p_user_id)
    );
$$;

revoke execute on function public.can_upload_initiative_care_proof_photo(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.can_access_initiative_care_proof_photo(uuid, uuid, uuid)
  from public, anon;

grant execute on function public.can_upload_initiative_care_proof_photo(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.can_access_initiative_care_proof_photo(uuid, uuid, uuid)
  to authenticated;

-- ===========================================================================
-- 3. Tulis ulang enam policy foto
--
-- Asal SELURUHNYA migrasi 053 bagian E (053:302-440) -- definisi hidup
-- terakhir; tidak ada migrasi setelahnya yang menyentuh keenamnya, 059 pun
-- sengaja tidak.
--
-- Perubahan tunggal per policy: SATU cabang 'initiative_care_proof' /
-- folder 'initiative-care-proofs' ditambahkan di URUTAN TERAKHIR. Cabang
-- tree_main, condition_record, dan task_proof disalin verbatim, termasuk
-- urutannya, termasuk pemakaian can_upload_* vs can_access_* yang
-- berbeda-beda antar policy.
--
-- Klausa `to <role>` tetap TIDAK ditambahkan: keenam policy di 053 memang
-- tanpa klausa itu (default `to public`), dan menambahkannya diam-diam akan
-- menggeser perilaku di luar lingkup migrasi ini. Penolakan anon tetap
-- bersandar pada revoke execute di bagian 2 dan di 019.
-- ===========================================================================

-- 3.1 -- public.photo_attachments

drop policy if exists "Allowed members can view photo attachments"
  on public.photo_attachments;

create policy "Allowed members can view photo attachments"
  on public.photo_attachments
  for select
  using (
    (entity_type = 'tree_main' and public.is_active_farm_member(farm_id, auth.uid()))
    or (entity_type = 'condition_record'
        and public.can_access_condition_record_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'task_proof'
        and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'initiative_care_proof'
        and public.can_access_initiative_care_proof_photo(farm_id, entity_id, auth.uid()))
  );

drop policy if exists "Allowed members can insert photo attachments"
  on public.photo_attachments;

create policy "Allowed members can insert photo attachments"
  on public.photo_attachments
  for insert
  with check (
    uploaded_by = auth.uid()
    and bucket = 'avology-photos'
    and public.avology_storage_path_farm_id(storage_path) = farm_id
    and public.avology_storage_path_entity_id(storage_path) = entity_id
    and (
      (entity_type = 'tree_main' and public.is_active_owner(farm_id, auth.uid()))
      or (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
      or (entity_type = 'task_proof'
          and public.can_upload_task_proof_photo(
            farm_id,
            public.avology_storage_path_task_id(storage_path),
            entity_id,
            auth.uid()))
      or (entity_type = 'initiative_care_proof'
          and public.can_upload_initiative_care_proof_photo(farm_id, entity_id, auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete photo attachments"
  on public.photo_attachments;

create policy "Allowed members can delete photo attachments"
  on public.photo_attachments
  for delete
  using (
    public.is_active_owner(farm_id, auth.uid())
    or (
      uploaded_by = auth.uid()
      and (
        (entity_type = 'condition_record'
          and public.can_upload_condition_record_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'task_proof'
          and public.can_access_task_proof_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'initiative_care_proof'
          and public.can_upload_initiative_care_proof_photo(farm_id, entity_id, auth.uid()))
      )
    )
  );

-- 3.2 -- storage.objects

drop policy if exists "Allowed members can read avology photo objects"
  on storage.objects;

create policy "Allowed members can read avology photo objects"
  on storage.objects
  for select
  using (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and public.is_active_farm_member(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_access_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_access_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'initiative-care-proofs'
        and public.can_access_initiative_care_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can upload avology photo objects"
  on storage.objects;

create policy "Allowed members can upload avology photo objects"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avology-photos'
    and (
      (public.avology_storage_path_entity_folder(name) = 'trees'
        and split_part(name, '/', 5) = 'main'
        and public.is_active_owner(
          public.avology_storage_path_farm_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'condition-reports'
        and public.can_upload_condition_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
        and public.can_upload_task_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_task_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'initiative-care-proofs'
        and public.can_upload_initiative_care_proof_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
    )
  );

drop policy if exists "Allowed members can delete avology photo objects"
  on storage.objects;

create policy "Allowed members can delete avology photo objects"
  on storage.objects
  for delete
  using (
    bucket_id = 'avology-photos'
    and (
      public.is_active_owner(public.avology_storage_path_farm_id(name), auth.uid())
      or exists (
        select 1 from public.photo_attachments pa
        where pa.bucket = objects.bucket_id
          and pa.storage_path = objects.name
          and pa.uploaded_by = auth.uid()
      )
      or (
        not exists (
          select 1 from public.photo_attachments pa
          where pa.bucket = objects.bucket_id
            and pa.storage_path = objects.name
        )
        and (
          (public.avology_storage_path_entity_folder(name) = 'condition-reports'
            and public.can_upload_condition_record_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'task-proofs'
            and public.can_upload_task_proof_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_task_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'initiative-care-proofs'
            and public.can_upload_initiative_care_proof_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
        )
      )
    )
  );

-- ===========================================================================
-- 4. Keterangan kolom planting_id
--
-- Kalimat 059 masih benar untuk task_proof, tapi tidak lagi lengkap sebagai
-- keterangan KOLOM: sejak migrasi ini ada entity_type kedua yang bisa NULL
-- karena alasan yang sama (banyak pohon), dan yang justru TERISI kalau
-- pohonnya cuma satu. Dibiarkan apa adanya, keterangan ini akan terbaca
-- seolah task_proof satu-satunya yang boleh NULL.
-- ===========================================================================

comment on column public.photo_attachments.planting_id is
  'Siklus tanam pemilik foto. NULL = siklus TIDAK DIKETAHUI, bukan milik siklus lain -- foto ber-NULL tetap wajib ditampilkan. Selalu NULL untuk task_proof (satu aktivitas bisa menyentuh banyak pohon sekaligus). Untuk initiative_care_proof: terisi bila aktivitasnya menaut TEPAT SATU pohon, NULL bila lebih.';

-- ===========================================================================
-- 5. Trigger planting_id: satu cabang baru
--
-- Fungsinya ditulis ULANG UTUH karena create or replace memang menggantikan
-- seluruh badan. Ketiga cabang lama -- task_proof, tree_main,
-- condition_record -- disalin VERBATIM dari 059 bagian 4, termasuk
-- komentarnya. Yang baru hanya cabang keempat dan satu variabel pencacah.
--
-- ---------------------------------------------------------------------------
-- KENAPA WAKTU ACUANNYA performed_at, DAN JANGAN DIGANTI KE now()
--
-- Ini pertanyaan yang akan muncul lagi, jadi jawabannya ditulis di sini.
--
-- care_activities TIDAK PUNYA KOLOM created_at. Diperiksa langsung: 004:168
-- mendefinisikan tabelnya tanpa kolom itu, dan tak satu pun dari 025, 043,
-- atau 049 menambahkannya. Jadi aturan 059 ("pakai created_at, karena ia yang
-- tidak bisa diubah") tidak bisa disalin apa adanya -- kolomnya tidak ada.
--
-- performed_at KEKAL SESUDAH INSERT, walau boleh dimundurkan SAAT insert:
--   * update_task_realization (043:352) menolak menyentuhnya, dan daftar kolom
--     di sana diberi komentar tegas "JANGAN menambahkan status atau
--     performed_at ke sini";
--   * grant UPDATE pada care_activities sudah dicabut dari authenticated
--     (043 bagian 4), dan tidak ada satu pun policy UPDATE;
--   * catatan inisiatif malah tidak bisa diedit sama sekali (027).
--
-- TAPI alasan sebenarnya bukan "kekal". Alasannya:
--
--   resolveCycleIndex() di src/utils/treeCycle.ts menempatkan kejadian riwayat
--   ke siklus memakai happenedAt -- yaitu performed_at. Kalau foto distempel
--   dengan waktu lain (now(), atau waktu unggah fotonya), maka catatan yang
--   dimundurkan akan TAMPIL di bawah pembatas siklus 1 sementara FOTONYA
--   distempel siklus 2, lalu disaring keluar oleh isPhotoVisibleInCycle dan
--   lenyap dari catatannya sendiri.
--
--   Memakai performed_at membuat foto dan catatannya selalu jatuh di siklus
--   yang sama. Itu bukan kompromi -- itu satu-satunya nilai yang konsisten
--   dengan cara riwayat sudah dikelompokkan hari ini.
--
-- JANGAN mengganti ini ke now() demi kerapian.
--
-- ---------------------------------------------------------------------------
-- KENAPA "LEBIH DARI SATU POHON -> NULL" TETAP DITULIS
--
-- Dari antarmuka hari ini aktivitas inisiatif SELALU menaut tepat satu pohon:
-- tree-care-activity-screen.tsx mengirim `treeIds: [tree.id]` dan tidak punya
-- pemilih pohon sama sekali; pohonnya datang dari parameter route.
--
-- Tetapi create_care_activity menerima p_tree_ids uuid[] berkardinalitas N,
-- dan komentar 027 menyebut layar pencatatan multi-pohon sebagai rencana.
-- Trigger yang menganggap "selalu satu" akan MEMILIH SATU POHON DARI BANYAK
-- begitu layar itu lahir -- benar untuk satu pohon, salah untuk sisanya,
-- persis cacat yang membuat task_proof dikecualikan di 059.
--
-- Karena itu jumlah tautnya DIHITUNG dari care_activity_trees, bukan
-- diasumsikan dari bentuk antarmuka.
--
-- ---------------------------------------------------------------------------
-- KENAPA SECURITY INVOKER MASIH AMAN UNTUK CABANG BARU INI
--
-- Fungsinya tetap SECURITY INVOKER (bawaan), sama seperti di 059. Cabang baru
-- membaca DUA tabel yang ber-RLS, jadi alasannya perlu diperiksa ulang dan
-- bukan sekadar diwarisi:
--
--   * care_activities      -- policy SELECT "Active members can view care
--                             activities" (029:29) = is_active_farm_member
--   * care_activity_trees  -- policy SELECT "View care activity trees by
--                             parent visibility" (029:41) = is_active_farm_member
--                             pada kebun induknya
--
-- Pengunggahnya dijamin PENCATAT aktivitas itu DAN anggota aktif oleh
-- can_upload_initiative_care_proof_photo di bagian 2, jadi kedua SELECT di atas
-- pasti mengembalikan barisnya secara utuh. Tidak ada yang perlu ditembus.
--
-- Ini bukan kehalusan: kalau RLS sampai MENYARING sebagian baris jembatan,
-- `count(*)` di bawah bisa bernilai 1 untuk aktivitas yang sebenarnya menaut
-- dua pohon, dan fotonya akan distempel siklus salah satu pohon -- persis
-- kesalahan yang cabang "lebih dari satu -> NULL" ada untuk mencegahnya.
-- Karena kedua policy itu berbasis KEBUN dan bukan per-pohon, penyaringan
-- separuh seperti itu tidak mungkin terjadi. Kalau salah satu policy itu kelak
-- dipersempit jadi per-pohon, fungsi ini WAJIB jadi SECURITY DEFINER.
-- ===========================================================================

create or replace function public.set_photo_attachment_planting()
returns trigger
language plpgsql
as $$
declare
  v_tree_id uuid;
  v_at timestamptz;
  v_tree_count integer;
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

  elsif new.entity_type = 'initiative_care_proof' then
    -- Waktu acuannya milik AKTIVITASNYA, bukan milik fotonya -- alasannya di
    -- kepala bagian 5. Syarat farm_id ikut disertakan: aktivitas dari kebun
    -- lain lebih baik dibiarkan NULL daripada dipasangkan lintas kebun.
    select ca.performed_at
    into v_at
    from public.care_activities ca
    where ca.id = new.entity_id
      and ca.farm_id = new.farm_id;

    -- Dihitung, bukan diasumsikan. Lihat kepala bagian 5.
    select count(*)
    into v_tree_count
    from public.care_activity_trees cat
    where cat.care_activity_id = new.entity_id;

    if v_tree_count = 1 then
      select cat.tree_id
      into v_tree_id
      from public.care_activity_trees cat
      where cat.care_activity_id = new.entity_id;
    else
      v_tree_id := null;
    end if;

  else
    -- entity_type di luar keempatnya tidak akan lolos
    -- photo_attachments_entity_type_check, tapi cabang ini membuat fungsinya
    -- tetap benar kalau daftar itu suatu saat bertambah.
    new.planting_id := null;
    return new;
  end if;

  if v_tree_id is null or v_at is null then
    new.planting_id := null;
    return new;
  end if;

  -- Aturannya SAMA PERSIS dengan bagian 2 dan 3 migrasi 059. Kalau salah
  -- satunya diubah, yang lain wajib ikut -- kalau tidak, foto lama dan foto
  -- baru akan ditempatkan dengan dua aturan berbeda dan tidak ada yang
  -- menyadarinya.
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

-- Trigger-nya sendiri TIDAK dibuat ulang: ia sudah terpasang oleh 059 dan
-- menunjuk fungsi ini berdasarkan nama, jadi create or replace di atas sudah
-- cukup. Membuatnya ulang hanya akan menambah jendela tanpa trigger di dalam
-- transaksi ini tanpa memberi apa pun.

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- VERIFIKASI SESUDAH PUSH (jalankan manual, di luar migrasi)
--
--   -- keempat entity_type diterima, yang lain tidak
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.photo_attachments'::regclass
--     and conname in (
--       'photo_attachments_entity_type_check',
--       'photo_attachments_storage_path_entity_folder_check'
--     );
--
--   -- keenam policy memuat cabang barunya
--   select tablename, policyname
--   from pg_policies
--   where (schemaname, tablename) in (('public','photo_attachments'), ('storage','objects'))
--     and qual || coalesce(with_check, '') like '%initiative_care_proof%'
--      or  coalesce(with_check, '') like '%initiative-care-proofs%';
--
--   -- task_proof TETAP tidak pernah terstempel siklus
--   select count(*) from public.photo_attachments
--   where entity_type = 'task_proof' and planting_id is not null;   -- harus 0
--
--   -- tidak ada foto yang siklusnya milik kebun lain
--   select count(*)
--   from public.photo_attachments pa
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where tp.farm_id <> pa.farm_id;   select count(*)
--   from public.photo_attachments pa
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where tp.farm_id <> pa.farm_id;                                  -- harus 0
--
--   -- initiative_care_proof yang terstempel harus menaut TEPAT SATU pohon
--   select count(*)
--   from public.photo_attachments pa
--   where pa.entity_type = 'initiative_care_proof'
--     and pa.planting_id is not null
--     and (select count(*) from public.care_activity_trees cat
--          where cat.care_activity_id = pa.entity_id) <> 1;          -- harus 0
-- ---------------------------------------------------------------------------
