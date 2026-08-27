-- 061_phase_harvest_record_photo.sql
--
-- Foto untuk catatan FASE PERTUMBUHAN dan PANEN.
--
-- ---------------------------------------------------------------------------
-- KENAPA DUA ENTITY_TYPE DALAM SATU MIGRASI
--
-- Biaya sebenarnya dari pekerjaan ini adalah PENULISAN ULANG KEENAM POLICY
-- FOTO, dan biaya itu sama besarnya entah yang ditambahkan satu entity_type
-- atau dua. Memecahnya jadi dua migrasi berarti membongkar dan menyusun ulang
-- keenam policy DUA KALI -- dua kesempatan salah salin, bukan satu. Itu
-- memperbanyak paparan, bukan menguranginya.
--
-- Keduanya juga bukan dua pekerjaan yang kebetulan bertetangga. Bentuk kedua
-- tabelnya sama: satu tree_id, satu kolom pencatat, satu waktu kejadian yang
-- BISA diedit lewat RPC, dan satu created_at yang kekal. Fungsi pendukungnya
-- sama huruf demi huruf kecuali nama tabel dan nama kolom pencatat. Path-nya
-- sama-sama empat segmen generik. Cabang trigger planting_id-nya sama persis
-- kecuali nama tabel. Memisahkannya menghasilkan dua migrasi yang saling
-- menyalin, dengan yang pertama dibongkar lagi oleh yang kedua.
--
-- ---------------------------------------------------------------------------
-- INI BUKAN FITUR BARU -- INI CETAK BIRU 020 YANG DIPASANG KEMBALI
--
-- Migrasi 020 dulu SUDAH membangun foto lengkap untuk kedua catatan ini:
-- entity_type, folder, keempat fungsi can_access_*/can_upload_*, dan keenam
-- policy. Migrasi 031 membuang semuanya -- termasuk baris fotonya dan berkas
-- Storage-nya -- karena Iterasi A dipangkas, bukan karena bentuknya salah.
--
-- Karena itu keempat fungsi di bagian 2 disalin VERBATIM dari 020:342-419.
-- Diperiksa kolom per kolom sebelum disalin, dan semuanya masih ada:
--   * growth_phase_records.recorded_by  -- 005:5, tidak pernah diubah
--   * harvest_records.harvested_by      -- 020:38; 045 mengubah fruit_count dan
--                                         menambah harvest_weight_kg, tapi
--                                         tidak menyentuh kolom ini
--   * is_active_farm_member             -- masih dipakai keenam policy hari ini
--
-- Yang TIDAK ikut disalin dari 020, dan itu disengaja:
--   * klausa `to authenticated` pada policy. 053 dan 060 membuangnya (default
--     `to public`), dan menambahkannya kembali diam-diam akan menggeser
--     perilaku di luar lingkup migrasi ini. Penolakan anon tetap bersandar
--     pada revoke execute di bawah dan di 019.
--   * `case` tanpa `else` pada CHECK folder. Bentuk 060 yang dipakai.
--
-- Nol berkas Storage disentuh dan nol baris foto dihapus: 031 sudah
-- mengosongkan kedua folder itu, jadi tidak ada baris lama yang bisa jatuh
-- keluar CHECK yang diperlebar di bagian 1.
--
-- ---------------------------------------------------------------------------
-- SIAPA YANG BOLEH APA -- POLA condition_record, BUKAN task_proof
--
-- Unggah  : HANYA pencatat catatan itu sendiri, yang masih anggota aktif.
-- Baca    : SELURUH anggota aktif kebun.
-- Hapus   : owner aktif (cabang pertama policy, sudah ada), ATAU pengunggah
--           yang sekaligus pencatatnya.
--
-- Aturan BACANYA sengaja LEBIH LONGGAR daripada task_proof dan
-- initiative_care_proof, dan itu bukan kelalaian. Fase dan panen adalah CATATAN
-- KEBUN, bukan bukti kerja seseorang: keduanya menerangkan keadaan pohon, sama
-- seperti catatan kondisi, dan sudah terbuka ke seluruh anggota aktif lewat
-- policy tabelnya sendiri ("Active members can view growth phase records"
-- 007:329, "Active members can view harvest records" 020:254). Menyempitkan
-- FOTONYA jadi lebih tertutup daripada CATATANNYA sendiri akan aneh dan tidak
-- menjaga apa pun. Bentuk yang diikuti can_access_condition_record_photo
-- (019:126).
--
-- PATOKANNYA is_active_farm_member, BUKAN is_active_worker. Kedua catatan ini
-- memang boleh dibuat PEMILIK: policy INSERT keduanya memakai
-- is_active_farm_member (007:335 dan 020:261), dan kedua layar pencatatannya
-- ada untuk kedua peran. Memakai is_active_worker akan mengunci pemilik keluar
-- dari fotonya sendiri.
--
-- Kedua tabel MEMAKU kolom pencatatnya pada saat INSERT -- `recorded_by =
-- auth.uid()` dan `harvested_by = auth.uid()` di policy INSERT-nya
-- masing-masing. Jadi can_upload_* yang bersandar pada kolom itu tidak bisa
-- ditipu dengan mencatatkan baris atas nama orang lain.
--
-- ---------------------------------------------------------------------------
-- YANG DILIHAT DI DALAM POLICY LAMA DAN SENGAJA TIDAK DIPERBAIKI
--
-- Dilaporkan di sini karena akan terlihat lagi oleh pembaca berikutnya, dan
-- supaya tidak ada yang mengira ini terlewat:
--
--   1. Policy DELETE photo_attachments memakai fungsi yang BERBEDA-BEDA per
--      cabang: condition_record dan initiative_care_proof memakai
--      can_upload_*, sedangkan task_proof memakai can_ACCESS_*.
--      Ketidakseragaman itu disalin APA ADANYA. Menyeragamkannya berarti
--      mengubah perilaku task_proof, yang dilarang.
--   2. Keempat fungsi 020 -- dan can_upload_condition_record_photo (019:145)
--      yang hidup hari ini -- TIDAK menyaring is_deleted. Catatan yang sudah
--      di-soft-delete tetap bisa diunggahi dan dibaca fotonya. Disalin apa
--      adanya: menambahkan saringan itu mengubah aturan, dan kolom soft-delete
--      dari 023 adalah utang terpisah.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DISENTUH
--
--   * task_proof, condition_record, tree_main, initiative_care_proof: NOL
--     perubahan perilaku. Keempat cabangnya pada keenam policy disalin
--     VERBATIM -- tidak diringkas, tidak dirapikan, tidak diurutkan ulang,
--     termasuk pemakaian can_upload_* vs can_access_* yang berbeda-beda.
--     Satu-satunya perbedaan dari 060 adalah dua cabang yang ditambahkan di
--     URUTAN TERAKHIR.
--   * Keempat helper path (019). Path fase dan panen EMPAT segmen, jadi
--     keduanya jatuh ke cabang generik avology_storage_path_entity_id yang
--     sudah ada. Nol fungsi path baru.
--   * Keempat CHECK farm/entity_id/file_size/mime.
--   * Keterangan kolom planting_id (060 bagian 4). Kalimatnya masih LENGKAP
--     sesudah migrasi ini: kedua entity_type baru tidak menambah sumber NULL
--     baru -- keduanya terikat TEPAT SATU pohon lewat kolom tree_id NOT NULL,
--     jadi tidak ada kasus "banyak pohon" seperti pada task_proof dan
--     initiative_care_proof.
--   * tree_history_view, is_archived, kolom soft-delete 023, src/lib/media.ts.
--   * Nol baris foto dihapus, nol berkas Storage disentuh.
--   * Jalur unggahnya tetap INSERT langsung, tidak dipindah ke RPC.
--
-- Nomor 017 dan 042 memang tidak pernah ada -- jangan diisi.

begin;

-- ===========================================================================
-- 1. Perlebar kedua CHECK yang mendaftar entity_type
--
-- Aman divalidasi penuh: keduanya hanya MENAMBAH nilai yang diterima, jadi
-- tidak ada baris lama yang bisa jatuh keluar. 031 sudah menghapus seluruh
-- baris 'growth_phase_record' dan 'harvest_record' yang pernah ada, jadi kedua
-- nilai ini benar-benar mulai dari nol.
-- ===========================================================================

alter table public.photo_attachments
  drop constraint if exists photo_attachments_entity_type_check;

alter table public.photo_attachments
  add constraint photo_attachments_entity_type_check
  check (entity_type = any (array[
    'tree_main'::text,
    'condition_record'::text,
    'task_proof'::text,
    'initiative_care_proof'::text,
    'growth_phase_record'::text,
    'harvest_record'::text
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
      when 'growth_phase_record' then 'growth-phase-records'
      when 'harvest_record' then 'harvest-records'
      else null
    end
  );

-- ===========================================================================
-- 2. Empat fungsi pendukung
--
-- Disalin VERBATIM dari migrasi 020:342-419, yang pernah dipasang dan berjalan
-- sebelum 031 membuangnya. SECURITY DEFINER, sama seperti keenam fungsi foto
-- lain (019, 060). Alasannya sama pula: pemanggilnya adalah ekspresi policy,
-- dan tanpa DEFINER fungsinya akan dievaluasi di bawah RLS tabel catatannya --
-- yang berarti policy foto bergantung pada policy tabel lain, dan pelonggaran
-- di sana akan merembes ke sini tanpa suara.
-- ===========================================================================

-- Baca: SELURUH anggota aktif kebun. Bentuk can_access_condition_record_photo
-- (019:126), BUKAN can_access_task_proof_photo (019:207) -- alasannya di kepala
-- migrasi ini.
create or replace function public.can_access_growth_phase_record_photo(
  p_farm_id uuid,
  p_growth_phase_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_phase_records gpr
    where gpr.id = p_growth_phase_record_id
      and gpr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

-- Unggah: HANYA pencatatnya. Tidak ada cabang owner -- pemilik tidak boleh
-- mengunggah foto atas nama orang lain, persis seperti pada condition_record,
-- task_proof, dan initiative_care_proof.
create or replace function public.can_upload_growth_phase_record_photo(
  p_farm_id uuid,
  p_growth_phase_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.growth_phase_records gpr
    where gpr.id = p_growth_phase_record_id
      and gpr.farm_id = p_farm_id
      and gpr.recorded_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_access_harvest_record_photo(
  p_farm_id uuid,
  p_harvest_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.harvest_records hr
    where hr.id = p_harvest_record_id
      and hr.farm_id = p_farm_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

create or replace function public.can_upload_harvest_record_photo(
  p_farm_id uuid,
  p_harvest_record_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.harvest_records hr
    where hr.id = p_harvest_record_id
      and hr.farm_id = p_farm_id
      and hr.harvested_by = p_user_id
      and public.is_active_farm_member(p_farm_id, p_user_id)
  );
$$;

-- WAJIB, dan mudah terlewat: 031 membuang keempat fungsi ini BERIKUT grant yang
-- menempel padanya. Tanpa baris di bawah, keempatnya akan lahir kembali dengan
-- EXECUTE terbuka untuk public dan anon.
revoke execute on function public.can_access_growth_phase_record_photo(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.can_upload_growth_phase_record_photo(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.can_access_harvest_record_photo(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.can_upload_harvest_record_photo(uuid, uuid, uuid)
  from public, anon;

grant execute on function public.can_access_growth_phase_record_photo(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.can_upload_growth_phase_record_photo(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.can_access_harvest_record_photo(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.can_upload_harvest_record_photo(uuid, uuid, uuid)
  to authenticated;

-- ===========================================================================
-- 3. Tulis ulang enam policy foto
--
-- Asal SELURUHNYA migrasi 060 bagian 3 -- definisi hidup terakhir; tidak ada
-- migrasi setelahnya yang menyentuh keenamnya.
--
-- Perubahan tunggal per policy: DUA cabang -- 'growth_phase_record' /
-- 'growth-phase-records' dan 'harvest_record' / 'harvest-records' --
-- ditambahkan di URUTAN TERAKHIR. Cabang tree_main, condition_record,
-- task_proof, dan initiative_care_proof disalin verbatim, termasuk urutannya,
-- termasuk pemakaian can_upload_* vs can_access_* yang berbeda-beda antar
-- policy.
--
-- drop + create, bukan alter policy, mengikuti 060 dan 053. Ini AMAN karena
-- DDL di PostgreSQL transaksional: seluruh bagian ini di dalam satu
-- begin/commit, jadi tidak ada sesi lain yang pernah melihat tabel tanpa
-- policy, dan kegagalan di mana pun me-rollback keenamnya utuh ke keadaan 060.
-- alter policy sengaja TIDAK dipakai: ia menuntut penulisan `using` vs
-- `with check` yang benar per jenis perintah, dan salah satu saja akan
-- diam-diam mengosongkan sisi yang lain.
--
-- Klausa `to <role>` tetap TIDAK ditambahkan: keenam policy di 060 memang tanpa
-- klausa itu (default `to public`).
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
    or (entity_type = 'growth_phase_record'
        and public.can_access_growth_phase_record_photo(farm_id, entity_id, auth.uid()))
    or (entity_type = 'harvest_record'
        and public.can_access_harvest_record_photo(farm_id, entity_id, auth.uid()))
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
      or (entity_type = 'growth_phase_record'
          and public.can_upload_growth_phase_record_photo(farm_id, entity_id, auth.uid()))
      or (entity_type = 'harvest_record'
          and public.can_upload_harvest_record_photo(farm_id, entity_id, auth.uid()))
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
        or (entity_type = 'growth_phase_record'
          and public.can_upload_growth_phase_record_photo(farm_id, entity_id, auth.uid()))
        or (entity_type = 'harvest_record'
          and public.can_upload_harvest_record_photo(farm_id, entity_id, auth.uid()))
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
      or (public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
        and public.can_access_growth_phase_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'harvest-records'
        and public.can_access_harvest_record_photo(
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
      or (public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
        and public.can_upload_growth_phase_record_photo(
          public.avology_storage_path_farm_id(name),
          public.avology_storage_path_entity_id(name), auth.uid()))
      or (public.avology_storage_path_entity_folder(name) = 'harvest-records'
        and public.can_upload_harvest_record_photo(
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
          or (public.avology_storage_path_entity_folder(name) = 'growth-phase-records'
            and public.can_upload_growth_phase_record_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
          or (public.avology_storage_path_entity_folder(name) = 'harvest-records'
            and public.can_upload_harvest_record_photo(
              public.avology_storage_path_farm_id(name),
              public.avology_storage_path_entity_id(name), auth.uid()))
        )
      )
    )
  );

-- ===========================================================================
-- 4. Trigger planting_id: dua cabang baru
--
-- Fungsinya ditulis ULANG UTUH karena create or replace memang menggantikan
-- seluruh badan. Keempat cabang lama -- task_proof, tree_main,
-- condition_record, initiative_care_proof -- disalin VERBATIM dari 060 bagian
-- 5, termasuk komentarnya. Yang baru hanya dua cabang di bawahnya.
-- (Satu-satunya kata yang diubah pada salinan itu: "keempatnya" jadi
-- "keenamnya" di komentar cabang `else`, yang kalau dibiarkan akan menyebut
-- jumlah yang salah.)
--
-- ---------------------------------------------------------------------------
-- KENAPA WAKTU ACUANNYA created_at, DAN KENAPA ITU BUKAN performed_at
--
-- Kedua tabel ini punya DUA waktu, dan hanya satu di antaranya yang kekal:
--
--   growth_phase_records.recorded_at   BISA DIUBAH pengguna --
--     update_own_growth_phase_record (023:361) menulis
--     `recorded_at = coalesce(p_recorded_at, recorded_at)`.
--   growth_phase_records.created_at    KEKAL -- ditambahkan 023 dengan
--     `not null default now()`, dan tidak ada satu pun RPC yang menyentuhnya.
--
--   harvest_records.harvested_at       BISA DIUBAH pengguna --
--     update_own_harvest_record (045:203) menulis
--     `harvested_at = coalesce(p_harvested_at, harvested_at)`.
--   harvest_records.created_at         KEKAL -- 020:44, `not null default now()`,
--     dan 045 pun tidak menyentuhnya saat menulis ulang RPC-nya.
--
-- Yang dipakai created_at, dan alasannya KONSISTENSI DENGAN condition_record.
--
-- Fase, panen, dan kondisi adalah TIGA CATATAN YANG BENTUKNYA SAMA: satu
-- tree_id, satu kolom pencatat, satu waktu kejadian yang bisa diedit, satu
-- created_at yang kekal. Cabang condition_record di bawah memakai
-- tcr.created_at (059 bagian 4) -- padahal tree_condition_reports.reported_at
-- juga bisa diedit lewat update_own_tree_condition_report (023:276), jadi
-- keadaannya identik. Ketiganya harus mengikuti SATU aturan; kalau dua memakai
-- created_at dan satu memakai waktu kejadiannya, tidak akan ada yang bisa
-- mengingat mana yang mana.
--
-- KENAPA INI TIDAK BERTENTANGAN DENGAN 060, yang memilih performed_at:
--
--   care_activities TIDAK PUNYA KOLOM created_at sama sekali -- diperiksa
--   langsung di 004:168, dan tak satu pun dari 025, 043, atau 049
--   menambahkannya. 060 TIDAK PERNAH PUNYA PILIHAN. Itu keterbatasan tabel
--   yang berbeda, bukan preseden yang berlawanan.
--
-- AKIBAT YANG DITERIMA, DAN INI BUKAN CACAT BARU:
--
--   resolveCycleIndex() di src/utils/treeCycle.ts menempatkan kejadian riwayat
--   ke siklus memakai happenedAt -- yaitu recorded_at / harvested_at, bukan
--   created_at. Jadi kalau pengguna MEMUNDURKAN recorded_at atau harvested_at
--   melewati batas siklus SESUDAH fotonya terunggah, catatannya akan pindah ke
--   siklus lama sementara fotonya tetap terstempel siklus yang ditentukan
--   created_at, lalu disaring keluar oleh isPhotoVisibleInCycle.
--
--   Konsekuensi itu SUDAH BERLAKU untuk condition_record hari ini dan sudah
--   diterima. Yang ditulis di sini mengikutinya, bukan memperkenalkannya.
--
-- JANGAN mengganti ini ke recorded_at/harvested_at demi kerapian tampilan.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK ADA CABANG "LEBIH DARI SATU POHON -> NULL" DI SINI
--
-- Tidak dibutuhkan, dan menuliskannya justru akan menyesatkan. Kedua tabel
-- terikat ke SATU pohon lewat kolom tree_id yang NOT NULL (005:4 dan 020:37) --
-- tidak ada tabel jembatan seperti care_activity_trees, dan tidak ada jalan
-- untuk satu catatan menyentuh dua pohon. Pohonnya cukup dibaca langsung.
--
-- ---------------------------------------------------------------------------
-- KENAPA SECURITY INVOKER MASIH AMAN UNTUK KEDUA CABANG BARU
--
-- Fungsinya tetap SECURITY INVOKER (bawaan), sama seperti di 059 dan 060.
-- Kedua cabang baru membaca tabel ber-RLS, jadi alasannya diperiksa ulang dan
-- bukan sekadar diwarisi:
--
--   * growth_phase_records -- policy SELECT "Active members can view growth
--                             phase records" (007:329) = is_active_farm_member
--   * harvest_records      -- policy SELECT "Active members can view harvest
--                             records" (020:254) = is_active_farm_member
--
-- Pengunggahnya dijamin PENCATAT catatan itu DAN anggota aktif oleh
-- can_upload_*_photo di bagian 2, jadi kedua SELECT di atas pasti mengembalikan
-- barisnya. Tidak ada yang perlu ditembus. Keduanya berbasis KEBUN dan bukan
-- per-pohon, jadi penyaringan separuh tidak mungkin terjadi. Kalau salah satu
-- policy itu kelak dipersempit jadi per-pohon, fungsi ini WAJIB jadi
-- SECURITY DEFINER.
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
    -- kepala bagian 5 migrasi 060. Syarat farm_id ikut disertakan: aktivitas
    -- dari kebun lain lebih baik dibiarkan NULL daripada dipasangkan lintas
    -- kebun.
    select ca.performed_at
    into v_at
    from public.care_activities ca
    where ca.id = new.entity_id
      and ca.farm_id = new.farm_id;

    -- Dihitung, bukan diasumsikan. Lihat kepala bagian 5 migrasi 060.
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

  elsif new.entity_type = 'growth_phase_record' then
    -- created_at, BUKAN recorded_at. Alasannya di kepala bagian 4. Syarat
    -- farm_id disertakan dengan alasan yang sama seperti cabang-cabang di atas.
    select gpr.tree_id, gpr.created_at
    into v_tree_id, v_at
    from public.growth_phase_records gpr
    where gpr.id = new.entity_id
      and gpr.farm_id = new.farm_id;

  elsif new.entity_type = 'harvest_record' then
    -- created_at, BUKAN harvested_at. Alasannya di kepala bagian 4.
    select hr.tree_id, hr.created_at
    into v_tree_id, v_at
    from public.harvest_records hr
    where hr.id = new.entity_id
      and hr.farm_id = new.farm_id;

  else
    -- entity_type di luar keenamnya tidak akan lolos
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
--   -- keenam entity_type diterima, yang lain tidak
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.photo_attachments'::regclass
--     and conname in (
--       'photo_attachments_entity_type_check',
--       'photo_attachments_storage_path_entity_folder_check'
--     );
--
--   -- keempat fungsi baru ada, dan anon TIDAK boleh menjalankannya
--   select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_boleh
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in (
--       'can_access_growth_phase_record_photo', 'can_upload_growth_phase_record_photo',
--       'can_access_harvest_record_photo', 'can_upload_harvest_record_photo'
--     );                                        -- anon_boleh harus false semua
--
--   -- keenam policy memuat kedua cabang barunya
--   select tablename, policyname
--   from pg_policies
--   where (schemaname, tablename) in (('public','photo_attachments'), ('storage','objects'))
--     and (coalesce(qual, '') || coalesce(with_check, '')) like '%harvest%';
--
--   -- task_proof TETAP tidak pernah terstempel siklus
--   select count(*) from public.photo_attachments
--   where entity_type = 'task_proof' and planting_id is not null;   -- harus 0
--
--   -- tidak ada foto yang siklusnya milik kebun lain
--   select count(*)
--   from public.photo_attachments pa
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where tp.farm_id <> pa.farm_id;                                 -- harus 0
--
--   -- foto fase & panen selalu menunjuk siklus pohon catatannya sendiri
--   select count(*)
--   from public.photo_attachments pa
--   join public.growth_phase_records gpr on gpr.id = pa.entity_id
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where pa.entity_type = 'growth_phase_record'
--     and tp.tree_id <> gpr.tree_id;                                -- harus 0
--
--   select count(*)
--   from public.photo_attachments pa
--   join public.harvest_records hr on hr.id = pa.entity_id
--   join public.tree_plantings tp on tp.id = pa.planting_id
--   where pa.entity_type = 'harvest_record'
--     and tp.tree_id <> hr.tree_id;                                 -- harus 0
-- ---------------------------------------------------------------------------
