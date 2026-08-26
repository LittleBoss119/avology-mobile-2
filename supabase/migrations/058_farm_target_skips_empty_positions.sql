-- 058_farm_target_skips_empty_positions.sql
--
-- Jadwal se-kebun berhenti menautkan posisi yang tidak ada pohonnya.
--
-- MASALAHNYA: cabang target_type = 'farm' di complete_task (057:889, warisan
-- verbatim dari 050:217) menautkan SELURUH pohon kebun yang tidak terarsip,
-- tanpa memeriksa siklus tanam. Posisi yang siklusnya sudah ditutup -- posisi
-- yang secara fisik kosong, tidak ada pohonnya sama sekali -- karenanya ikut
-- tercatat menerima perawatan setiap kali satu jadwal se-kebun diselesaikan.
--
-- Akibatnya permanen, bukan kosmetik. Riwayat posisi kosong memuat "Penyiraman
-- dicatat" untuk pohon yang sudah tidak ada, dan care_activity_trees sengaja
-- tidak punya jalur DELETE (025:67) -- tautan yang salah tidak bisa dikoreksi
-- setelah masuk. Antarmuka sudah menjanjikan ke pemilik bahwa posisi kosong
-- tidak mendapat jadwal perawatan; migrasi ini yang menepatinya.
--
-- ===========================================================================
-- KEPUTUSAN TERKUNCI -- JANGAN DIULANG SALAH
--
-- Penyaringan siklus aktif terjadi saat HIMPUNAN POHON DIPILIH, bukan saat
-- PEKERJAAN DICATAT.
--
--   * target_type = 'tree'  -- himpunannya TERSIMPAN di care_schedule_trees,
--     dan disaring saat jadwal dibuat (create_manual_schedule) serta saat
--     jadwal penerus lahir (create_successor_schedule), keduanya migrasi 057.
--     complete_task menautkan apa adanya dari jembatan itu.
--
--   * target_type = 'farm'  -- TIDAK ADA himpunan tersimpan. Ia diresolusi
--     saat penyelesaian, jadi penyaringnya memang harus ada di situ, dan
--     itulah satu-satunya yang diubah migrasi ini.
--
-- MENYARING CABANG 'tree' SAAT PENYELESAIAN ADALAH SALAH. Ia akan menghapus
-- jejak pekerjaan yang benar-benar terjadi, setiap kali pemilik menutup siklus
-- sebuah pohon setelah pekerjaannya dilakukan.
--
-- Pagarnya sudah terpasang: asersi stage 16 bernama
--   'the closed tree keeps the work recorded against it'
-- Jangan diubah, jangan dilonggarkan. Kalau ia merah setelah perubahanmu,
-- kamu menyaring di tempat yang salah -- berhenti, jangan sesuaikan tesnya.
-- ===========================================================================
--
-- PRASYARAT: 057 sudah dijalankan dan terverifikasi.
--
-- SIGNATURE TIDAK BERUBAH, jadi `create or replace` dan TIDAK ADA DROP
-- FUNCTION. Drop akan ikut membuang grant execute yang menempel untuk
-- `authenticated` (pelajaran 043:220), dan tanpa itu pekerja kena "permission
-- denied" dan tidak bisa menyelesaikan tugas apa pun. Perlakuan yang sama
-- dipakai 050 dan 057 terhadap fungsi ini.
--
-- Yang SENGAJA TIDAK disentuh:
--   * Cabang 'tree' dan cabang 'custom' -- disalin VERBATIM dari 057.
--   * Rantai jadwal berulang. create_successor_schedule tidak diubah; jadwal
--     se-kebun tetap berulang apa pun isi kebunnya, termasuk kebun yang
--     seluruh posisinya kosong.
--   * Baris care_activity_trees yang SUDAH ADA. Aktivitas yang sudah tercatat
--     adalah fakta tersimpan, sesalah apa pun tautannya. Nol DELETE, nol
--     UPDATE, nol backfill di migrasi ini.
--   * care_activity_trees tidak diberi jalur DELETE.
--   * create_care_activity (027:107) -- satu-satunya penulis lain ke tabel
--     jembatan itu. Ia menautkan tepat id yang dikirim pemanggil, bukan
--     menurunkannya dari isi kebun, jadi ia bukan penaut massal. Ia memang
--     juga tidak memeriksa siklus tanam, tapi itu urusan terpisah dan bukan
--     bagian migrasi ini.
--   * trees.is_archived, tree_history_view, foto, kolom bayangan
--     target_tree_id, dan kaitan current_condition = 'dead' dengan penutupan
--     siklus.

begin;

-- ===========================================================================
-- 1. complete_task -- cabang 'farm' melewati posisi tanpa siklus tanam aktif
--
-- Seluruh isi fungsi ini DIPERTAHANKAN VERBATIM dari 057:763 kecuali satu
-- blok: cabang `elsif task_target_type = 'farm'`. Empat penjaga di awal, dua
-- validasi pasangan bahan, daftar kolom INSERT care_activities, dan kedua
-- jalur cabang 'tree' tidak bergeser satu karakter pun -- supaya penanganan
-- galat di klien tidak berubah.
--
-- KENAPA MEMAKAI ULANG filter_trees_with_active_planting (057:278) alih-alih
-- menulis `exists (... tree_plantings ...)` di tempat:
--
--   Aturan "posisi ini masih ditanami" sekarang dipakai tiga fungsi:
--   create_manual_schedule, create_successor_schedule, dan mulai sekarang
--   complete_task. Ditulis ulang di sini, ia jadi salinan keempat yang bisa
--   menyimpang pada perubahan berikutnya tanpa satu pun error memberi tahu.
--
--   Harganya satu array perantara: daftar id pohon kebun dirakit dulu, baru
--   dilewatkan. Untuk kebun dengan grid maksimum 26 baris x 26 kolom -- dan
--   kebun nyata di proyek ini jauh lebih kecil -- ongkos itu tidak berarti.
--   Satu sumber aturan lebih berharga daripada satu kueri yang sedikit lebih
--   rapat.
--
--   is_archived TETAP ditulis di sini, bukan di fungsi itu:
--   filter_trees_with_active_planting sengaja hanya tahu soal siklus tanam.
--   Kedua syarat berdiri sendiri dan sengaja tidak disatukan -- arsip adalah
--   keputusan pemilik atas sebuah POSISI, siklus tanam adalah fakta soal ada
--   atau tidaknya POHON di posisi itu.
--
-- NOL POHON BUKAN GALAT. Kebun baru yang belum ditanami, dan kebun yang
-- seluruh posisinya sedang kosong, adalah keadaan sah. `unnest` atas array
-- kosong menghasilkan nol baris, INSERT-nya menautkan nol pohon, dan fungsi
-- ini mengembalikan id aktivitas seperti biasa. TIDAK ADA pemeriksaan
-- `get diagnostics` di cabang ini -- berbeda dari cabang 'tree', di mana nol
-- baris memang menandakan data rusak. Pekerja tetap boleh menyelesaikan
-- tugasnya; pekerjaannya sungguh dilakukan, hanya tidak menempel di pohon
-- mana pun.
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
    -- VERBATIM dari 057:842-887. TIDAK menyaring siklus tanam, dan itu
    -- disengaja -- lihat KEPUTUSAN TERKUNCI di kepala berkas.
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
    -- SATU-SATUNYA yang berubah di migrasi ini.
    --
    -- Dua syarat, berdiri sendiri:
    --   * is_archived = false -- keputusan pemilik untuk menyembunyikan
    --     sebuah POSISI dari kebun yang dirawat. Sudah ada sejak 050.
    --   * punya siklus tanam aktif -- fakta soal ada atau tidaknya POHON di
    --     posisi itu. Ditegakkan lewat filter_trees_with_active_planting
    --     (057:278), fungsi yang sama yang dipakai create_manual_schedule dan
    --     create_successor_schedule.
    --
    -- `select distinct` dipertahankan mengikuti pola 027:107 dan 057, walau di
    -- sini sumbernya sudah unik dengan sendirinya (trees.id primary key, dan
    -- fungsi penyaringnya mengembalikan hasil array_agg atas kolom itu).
    -- Baris kembar apa pun akan menggagalkan SELURUH penyelesaian tugas lewat
    -- primary key jembatan, jadi penjaga ini dibiarkan berdiri.
    insert into public.care_activity_trees (care_activity_id, tree_id)
    select distinct new_activity_id, planted_tree_id
    from unnest(
      public.filter_trees_with_active_planting(
        task_farm_id,
        (
          select coalesce(array_agg(tr.id), '{}'::uuid[])
          from public.trees tr
          where tr.farm_id = task_farm_id
            and tr.is_archived = false
        )
      )
    ) as planted_tree_id;
  end if;

  return new_activity_id;
end;
$function$;

-- Grant SENGAJA tidak ditulis ulang: tidak ada DROP FUNCTION di migrasi ini,
-- sehingga grant execute untuk `authenticated` dari 043:227 tetap menempel.
-- Verifikasi nomor 2 di bawah tetap wajib dijalankan untuk memastikannya.

-- ===========================================================================
-- 2. Muat ulang cache schema PostgREST
--
-- Signature tidak berubah, tetapi definisi fungsinya berubah. Reload murah dan
-- konsisten dengan seluruh migrasi sebelumnya yang menyentuh fungsi ini.
-- ===========================================================================

notify pgrst, 'reload schema';

commit;

-- ===========================================================================
-- VERIFIKASI SETELAH MENJALANKAN (jalankan manual, jangan diasumsikan)
--
-- 1. complete_task TIDAK ter-overload dan signature-nya TIDAK berubah --
--    harus TEPAT SATU baris:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'complete_task';
--
--    -> harus: complete_task(uuid, text, text, numeric, text)
--    -> kalau muncul lebih dari satu baris, `create or replace` malah membuat
--       overload dan klien bisa memanggil versi lama. STOP.
--
-- 2. Grant execute masih menempel (harus, karena tidak ada DROP FUNCTION):
--
--      select routine_name, grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_name = 'complete_task';
--
--    -> `authenticated` wajib muncul. Kalau hilang, pekerja kena
--       "permission denied" dan tidak bisa menyelesaikan tugas apa pun:
--       grant execute on function
--         public.complete_task(uuid, text, text, numeric, text) to authenticated;
--
-- 3. filter_trees_with_active_planting masih ada dan masih satu-satunya:
--
--      select p.oid::regprocedure
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname = 'filter_trees_with_active_planting';
--
--    -> harus: filter_trees_with_active_planting(uuid, uuid[])
--
-- 4. TIDAK ADA baris care_activity_trees yang hilang. Catat angkanya SEBELUM
--    db push, lalu bandingkan sesudahnya -- migrasi ini tidak boleh mengubah
--    satu baris pun:
--
--      select count(*) from public.care_activity_trees;
--
-- 5. ALUR NYATA -- ini inti migrasinya, jangan dilewat.
--    a. Di kebun yang punya campuran posisi berpohon dan posisi kosong
--       (tutup siklus salah satu posisi lewat end_tree_planting), buat jadwal
--       bertarget SELURUH KEBUN, tugaskan ke pekerja, selesaikan sebagai
--       pekerja itu. Lalu:
--
--         select tr.tree_code
--         from public.care_activity_trees cat
--         join public.trees tr on tr.id = cat.tree_id
--         where cat.care_activity_id = '<activity uuid>'
--         order by tr.row_position, tr.column_position;
--
--       -> posisi yang siklusnya sudah ditutup TIDAK BOLEH muncul.
--
--    b. Tutup siklus SELURUH posisi kebun itu, lalu selesaikan satu tugas
--       se-kebun lagi. Penyelesaiannya HARUS berhasil, dan:
--
--         select count(*) from public.care_activity_trees
--         where care_activity_id = '<activity uuid>';
--       -> harus 0, tanpa exception apa pun.
--
--    c. Riwayat posisi kosong (layar detail pohon, keadaan "Belum ditanami")
--       tidak boleh lagi bertambah entri perawatan setelah jadwal se-kebun
--       berikutnya diselesaikan.
--
-- 6. Cabang 'tree' TIDAK ikut berubah. Buat jadwal bertarget beberapa pohon,
--    tutup siklus salah satunya, lalu selesaikan tugasnya:
--
--      select count(*) from public.care_activity_trees
--      where care_activity_id = '<activity uuid>';
--
--    -> pohon yang siklusnya baru ditutup HARUS tetap ikut tertaut. Kalau ia
--       hilang, penyaringnya bocor ke cabang yang salah -- lihat KEPUTUSAN
--       TERKUNCI di kepala berkas. STOP.
-- ===========================================================================
